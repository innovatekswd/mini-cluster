package workers

import (
	"testing"
	"time"
)

func TestComputeDelta_Normal(t *testing.T) {
	// Normal case: counter increases over 5 seconds
	elapsed := 5.0
	current := uint64(1000)
	previous := uint64(500)
	want := float64(500) / 5.0 // 100 bytes/sec

	got := computeDelta(current, previous, elapsed)
	if got != want {
		t.Errorf("computeDelta(%d, %d, %f) = %f, want %f", current, previous, elapsed, got, want)
	}
}

func TestComputeDelta_FirstSample(t *testing.T) {
	// First sample: previous is 0 → should return 0
	got := computeDelta(1000, 0, 5.0)
	if got != 0 {
		t.Errorf("computeDelta(1000, 0, 5.0) = %f, want 0", got)
	}
}

func TestComputeDelta_ZeroElapsed(t *testing.T) {
	// No elapsed time → should return 0
	got := computeDelta(1000, 500, 0.0)
	if got != 0 {
		t.Errorf("computeDelta(1000, 500, 0.0) = %f, want 0", got)
	}
}

func TestComputeDelta_NegativeElapsed(t *testing.T) {
	// Negative elapsed (clock skew) → should return 0
	got := computeDelta(1000, 500, -1.0)
	if got != 0 {
		t.Errorf("computeDelta(1000, 500, -1.0) = %f, want 0", got)
	}
}

func TestComputeDelta_CounterReset(t *testing.T) {
	// Counter reset (current < previous, e.g. after reboot) → should return 0
	got := computeDelta(100, 1000, 5.0)
	if got != 0 {
		t.Errorf("computeDelta(100, 1000, 5.0) = %f, want 0 (counter reset)", got)
	}
}

func TestComputeDelta_NoChange(t *testing.T) {
	// No traffic: counter stays the same
	got := computeDelta(500, 500, 5.0)
	if got != 0 {
		t.Errorf("computeDelta(500, 500, 5.0) = %f, want 0", got)
	}
}

func TestComputeDelta_LargeValues(t *testing.T) {
	// Large counter values (realistic for long-running systems)
	current := uint64(10_000_000_000) // 10 GB
	previous := uint64(9_999_500_000)  // 9.9995 GB
	elapsed := 10.0
	want := float64(500_000) / 10.0 // 50,000 bytes/sec

	got := computeDelta(current, previous, elapsed)
	if got != want {
		t.Errorf("computeDelta(large) = %f, want %f", got, want)
	}
}

func TestComputeDelta_MaxUint64Overflow(t *testing.T) {
	// Near max uint64 - counter did not wrap, just large
	current := uint64(18_446_744_073_709_551_000)
	previous := uint64(18_446_744_073_709_000_000)
	elapsed := 60.0
	want := float64(current-previous) / elapsed

	got := computeDelta(current, previous, elapsed)
	if got != want {
		t.Errorf("computeDelta(near max) = %f, want %f", got, want)
	}
}

func TestNetworkState_InitialState(t *testing.T) {
	state := &networkState{prevTime: time.Now()}
	if state.prevBytesSent != 0 {
		t.Error("new networkState should have zero prevBytesSent")
	}
	if state.prevBytesRecv != 0 {
		t.Error("new networkState should have zero prevBytesRecv")
	}
}

func TestNetworkState_SequentialSamples(t *testing.T) {
	now := time.Now()
	state := &networkState{
		prevBytesSent: 0,
		prevBytesRecv: 0,
		prevTime:      now,
	}

	// First sample: no rate yet (previous was 0)
	sent1 := uint64(1000)
	recv1 := uint64(2000)
	later1 := now.Add(5 * time.Second)

	rate1Send := computeDelta(sent1, state.prevBytesSent, later1.Sub(state.prevTime).Seconds())
	rate1Recv := computeDelta(recv1, state.prevBytesRecv, later1.Sub(state.prevTime).Seconds())

	if rate1Send != 0 {
		t.Errorf("first sample send rate should be 0, got %f", rate1Send)
	}
	if rate1Recv != 0 {
		t.Errorf("first sample recv rate should be 0, got %f", rate1Recv)
	}

	// Update state
	state.prevBytesSent = sent1
	state.prevBytesRecv = recv1
	state.prevTime = later1

	// Second sample: now we have rates
	sent2 := uint64(3000) // +2000 bytes over 5s = 400 bytes/s
	recv2 := uint64(5500) // +3500 bytes over 5s = 700 bytes/s
	later2 := later1.Add(5 * time.Second)

	rate2Send := computeDelta(sent2, state.prevBytesSent, later2.Sub(state.prevTime).Seconds())
	rate2Recv := computeDelta(recv2, state.prevBytesRecv, later2.Sub(state.prevTime).Seconds())

	if rate2Send != 400.0 {
		t.Errorf("second sample send rate = %f, want 400.0", rate2Send)
	}
	if rate2Recv != 700.0 {
		t.Errorf("second sample recv rate = %f, want 700.0", rate2Recv)
	}
}

func TestComputeDelta_InterfaceFlap(t *testing.T) {
	// Simulate interface going down and coming back up (counter resets to 0)
	state := &networkState{
		prevBytesSent: 50000,
		prevBytesRecv: 100000,
		prevTime:      time.Now(),
	}

	// Interface comes back up with counters at 0
	currentSent := uint64(0)
	currentRecv := uint64(0)
	elapsed := 10.0

	rateSend := computeDelta(currentSent, state.prevBytesSent, elapsed)
	rateRecv := computeDelta(currentRecv, state.prevBytesRecv, elapsed)

	if rateSend != 0 {
		t.Errorf("interface flap send rate should be 0, got %f", rateSend)
	}
	if rateRecv != 0 {
		t.Errorf("interface flap recv rate should be 0, got %f", rateRecv)
	}
}
