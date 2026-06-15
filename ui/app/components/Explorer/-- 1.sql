-- 1. Enable Service Broker on msdb
ALTER DATABASE msdb SET ENABLE_BROKER WITH ROLLBACK IMMEDIATE;
GO

USE msdb;
GO

-- 2. Create the Stored Procedure to run the shrink loop
CREATE OR ALTER PROCEDURE dbo.sp_WeeklyLogShrink
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @dbName NVARCHAR(256), @logName NVARCHAR(256), @sql NVARCHAR(MAX);
    DECLARE db_cursor CURSOR FOR 
    SELECT name FROM sys.databases WHERE name NOT IN ('master', 'model', 'msdb', 'tempdb') AND state_desc = 'ONLINE';
    
    OPEN db_cursor;
    FETCH NEXT FROM db_cursor INTO @dbName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @logName = name FROM sys.master_files WHERE database_id = DB_ID(@dbName) AND type = 1;
        SET @sql = 'ALTER DATABASE [' + @dbName + '] SET RECOVERY SIMPLE; USE [' + @dbName + ']; DBCC SHRINKFILE ([' + @logName + '], 10);';
        EXEC sp_executesql @sql;
        FETCH NEXT FROM db_cursor INTO @dbName;
    END;
    CLOSE db_cursor; DEALLOCATE db_cursor;

    -- CRITICAL: Reschedule this procedure to run again in exactly 7 days
    DECLARE @dialog_handle UNIQUEIDENTIFIER;
    BEGIN DIALOG CONVERSATION @dialog_handle
        FROM SERVICE WeeklyShrinkService TO SERVICE 'WeeklyShrinkService'
        ON CONTRACT [DEFAULT] WITH ENCRYPTION = OFF;
    BEGIN CONVERSATION TIMER (@dialog_handle) TIMEOUT = 604800; -- 604,800 seconds = 1 week
END;
GO

-- 3. Set up the Broker Queue and Service routing
CREATE QUEUE WeeklyShrinkQueue WITH ACTIVATION (
    STATUS = ON,
    PROCEDURE_NAME = dbo.sp_WeeklyLogShrink,
    MAX_QUEUE_READERS = 1,
    EXECUTE AS OWNER
);
GO

CREATE SERVICE WeeklyShrinkService ON QUEUE WeeklyShrinkQueue ([DEFAULT]);
GO

-- 4. KICKSTART THE LOOP (Run this manually once to start the infinite chain)
EXEC dbo.sp_WeeklyLogShrink;
GO