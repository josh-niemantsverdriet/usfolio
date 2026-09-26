import sql from "mssql";
import { Service, emptyState } from "./service.js";
import type { State } from "../../shared/types.js";

let pool: Promise<sql.ConnectionPool> | undefined;
export function connectionConfig(): sql.config {
  for (const key of ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"])
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  return {
    server: process.env.SQL_SERVER!,
    database: process.env.SQL_DATABASE!,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate:
        process.env.SQL_TRUST_CERTIFICATE === "true" &&
        process.env.AZURE_FUNCTIONS_ENVIRONMENT !== "Production",
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 20000,
  };
}
const tables = {
  profiles: "Profiles",
  details: "Details",
  partnerships: "Partnerships",
  invitations: "Invitations",
  deleted: "DeletedIdentities",
} as const;
// A single transaction lock deliberately favors simple, auditable consistency at MVP scale.
// Reads also acquire the lock: revocation cannot race with a subsequent read or edit.
export async function transaction<T>(run: (service: Service) => T): Promise<T> {
  pool ??= new sql.ConnectionPool(connectionConfig()).connect().catch((e) => {
    pool = undefined;
    throw e;
  });
  const tx = new sql.Transaction(await pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await new sql.Request(tx).query(
      "DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource='usfolio-state', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r < 0 THROW 50001, 'Collection is busy', 1;",
    );
    const state = emptyState();
    for (const [key, table] of Object.entries(tables)) {
      const result = await new sql.Request(tx).query(
        `SELECT payload FROM dbo.${table}`,
      );
      (state[key as keyof State] as unknown[]) = result.recordset.map(
        (r: { payload: string }) => JSON.parse(r.payload),
      );
    }
    const before = structuredClone(state),
      result = run(new Service(state));
    // Write only changed rows. SQL parameters protect all user-supplied values.
    for (const [key, table] of Object.entries(tables)) {
      const oldRows = before[key as keyof State] as (string | { id: string })[],
        newRows = state[key as keyof State] as (string | { id: string })[];
      const id = (r: string | { id: string }) =>
        typeof r === "string" ? r : r.id;
      for (const row of oldRows)
        if (!newRows.some((r) => id(r) === id(row)))
          await new sql.Request(tx)
            .input("id", sql.NVarChar(64), id(row))
            .query(`DELETE FROM dbo.${table} WHERE id=@id`);
      for (const row of newRows) {
        const old = oldRows.find((r) => id(r) === id(row));
        if (JSON.stringify(old) === JSON.stringify(row)) continue;
        const req = new sql.Request(tx)
          .input("id", sql.NVarChar(64), id(row))
          .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(row));
        await req.query(
          old
            ? `UPDATE dbo.${table} SET payload=@payload WHERE id=@id`
            : `INSERT dbo.${table}(id,payload) VALUES (@id,@payload)`,
        );
      }
    }
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}
