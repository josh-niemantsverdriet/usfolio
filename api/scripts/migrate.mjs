import sql from "mssql";
import { readFile } from "node:fs/promises";
const pool = await sql.connect({
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.SQL_TRUST_CERTIFICATE === "true",
  },
});
const tx = new sql.Transaction(pool);
try {
  await tx.begin();
  await new sql.Request(tx).query(
    "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='usfolio-migration',@LockMode='Exclusive',@LockOwner='Transaction'; IF @r<0 THROW 50001,'Migration locked',1; IF OBJECT_ID('dbo.SchemaMigrations') IS NULL CREATE TABLE dbo.SchemaMigrations (version int PRIMARY KEY, appliedAt datetime2 DEFAULT SYSUTCDATETIME());",
  );
  const done = await new sql.Request(tx).query(
    "SELECT version FROM dbo.SchemaMigrations WHERE version=1",
  );
  if (!done.recordset.length) {
    await new sql.Request(tx).batch(
      await readFile(
        new URL("../migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    await new sql.Request(tx).query(
      "INSERT dbo.SchemaMigrations(version) VALUES (1)",
    );
  }
  await tx.commit();
  console.log("Database is up to date (migration 001).");
} catch (e) {
  await tx.rollback();
  throw e;
} finally {
  await pool.close();
}
