import sql from "mssql";
const password = process.env.USFOLIO_RUNTIME_PASSWORD;
if (!password || password.length < 24)
  throw new Error("A strong runtime password is required.");
const pool = await sql.connect({
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
});
try {
  const request = pool.request().input("password", sql.NVarChar(128), password);
  await request.query(`
  IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'usfolio_app')
  BEGIN
   DECLARE @statement nvarchar(max)=N'CREATE USER [usfolio_app] WITH PASSWORD = '+QUOTENAME(@password,'''');
   EXEC sys.sp_executesql @statement;
  END;
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Profiles TO [usfolio_app];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Details TO [usfolio_app];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Partnerships TO [usfolio_app];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Invitations TO [usfolio_app];
  GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.DeletedIdentities TO [usfolio_app];
 `);
  console.log("Runtime user has access to only the five application tables.");
} finally {
  await pool.close();
}
