using System.Collections.Concurrent;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface ILogRingBufferService
{
    void Add(Guid serviceId, SessionLogEntry entry);
    List<SessionLogEntry> GetRecent(Guid serviceId, int count = 200);
    List<SessionLogEntry> GetAll(Guid serviceId);
    void Clear(Guid serviceId);
}

public class LogRingBufferService : ILogRingBufferService
{
    private readonly ConcurrentDictionary<Guid, RingBuffer> _buffers = new();
    private const int DefaultCapacity = 500;

    public void Add(Guid serviceId, SessionLogEntry entry)
    {
        var buffer = _buffers.GetOrAdd(serviceId, _ => new RingBuffer(DefaultCapacity));
        buffer.Add(entry);
    }

    public List<SessionLogEntry> GetRecent(Guid serviceId, int count = 200)
    {
        if (!_buffers.TryGetValue(serviceId, out var buffer))
            return new List<SessionLogEntry>();

        return buffer.GetRecent(count);
    }

    public List<SessionLogEntry> GetAll(Guid serviceId)
    {
        if (!_buffers.TryGetValue(serviceId, out var buffer))
            return new List<SessionLogEntry>();

        return buffer.GetAll();
    }

    public void Clear(Guid serviceId)
    {
        _buffers.TryRemove(serviceId, out _);
    }

    private class RingBuffer
    {
        private readonly SessionLogEntry[] _buffer;
        private readonly int _capacity;
        private int _head;
        private int _count;
        private readonly object _lock = new();

        public RingBuffer(int capacity)
        {
            _capacity = capacity;
            _buffer = new SessionLogEntry[capacity];
            _head = 0;
            _count = 0;
        }

        public void Add(SessionLogEntry entry)
        {
            lock (_lock)
            {
                _buffer[_head] = entry;
                _head = (_head + 1) % _capacity;
                if (_count < _capacity)
                    _count++;
            }
        }

        public List<SessionLogEntry> GetAll()
        {
            lock (_lock)
            {
                var result = new List<SessionLogEntry>(_count);
                if (_count == 0) return result;

                int start = _count < _capacity ? 0 : _head;
                for (int i = 0; i < _count; i++)
                {
                    result.Add(_buffer[(start + i) % _capacity]);
                }
                return result;
            }
        }

        public List<SessionLogEntry> GetRecent(int count)
        {
            lock (_lock)
            {
                int take = Math.Min(count, _count);
                var result = new List<SessionLogEntry>(take);
                if (take == 0) return result;

                int start = (_head - take + _capacity) % _capacity;
                for (int i = 0; i < take; i++)
                {
                    result.Add(_buffer[(start + i) % _capacity]);
                }
                return result;
            }
        }
    }
}
