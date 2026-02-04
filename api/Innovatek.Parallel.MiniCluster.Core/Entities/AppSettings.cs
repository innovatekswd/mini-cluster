using System;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Application-wide settings stored in the database
    /// </summary>
    public class AppSettings
    {
        public int Id { get; set; } = 1; // Singleton pattern - always use ID 1
        
        // UI Settings
        public int MaxMessagesToKeepInUi { get; set; } = 1000;
        public bool EnableLogSearch { get; set; } = true;
        
        // Metrics Collection Settings
        public int MetricsCollectionIntervalSeconds { get; set; } = 5;
        public int MetricsRetentionHours { get; set; } = 24;
        
        // Aggregation intervals in seconds: 1, 5, 10, 20, 30, 60, 300 (5m), etc.
        public int MetricsAggregationIntervalSeconds { get; set; } = 60;
        
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
    }
}
