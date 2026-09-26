-- Run once using api/scripts/migrate.mjs. Row payloads keep the typed MVP schema simple.
-- Computed columns/indexes constrain ownership, JSON validity and membership shape.
CREATE TABLE dbo.Profiles (
 id nvarchar(64) NOT NULL PRIMARY KEY,
 payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1),
 subject AS CONVERT(nvarchar(255),JSON_VALUE(payload,'$.subject')) PERSISTED,
 CONSTRAINT UQ_ProfileSubject UNIQUE(subject)
);
CREATE TABLE dbo.Details (
 id nvarchar(64) NOT NULL PRIMARY KEY,
 payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1),
 ownerId AS CONVERT(nvarchar(64),JSON_VALUE(payload,'$.ownerId')) PERSISTED,
 visibility AS CONVERT(nvarchar(10),JSON_VALUE(payload,'$.visibility')) PERSISTED,
 CONSTRAINT CK_DetailVisibility CHECK(JSON_VALUE(payload,'$.visibility') IN ('shared','private'))
);
CREATE INDEX IX_DetailsOwner ON dbo.Details(ownerId,visibility);
CREATE TABLE dbo.Partnerships (id nvarchar(64) NOT NULL PRIMARY KEY,payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1));
CREATE TABLE dbo.Invitations (
 id nvarchar(64) NOT NULL PRIMARY KEY,payload nvarchar(max) NOT NULL CHECK(ISJSON(payload)=1),
 tokenHash AS CONVERT(nvarchar(64),JSON_VALUE(payload,'$.hash')) PERSISTED,
 CONSTRAINT UQ_InvitationHash UNIQUE(tokenHash)
);
CREATE TABLE dbo.DeletedIdentities (id nvarchar(64) NOT NULL PRIMARY KEY,payload nvarchar(max) NOT NULL);
