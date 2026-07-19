import numpy as np
import librosa
import scipy.signal

def find_optimal_loop(audio_path, target_start_sec, target_end_sec, window_sec=0.2):
    """
    Finds the mathematically optimal loop points using cross-correlation
    and zero-crossing alignment.

    Parameters:
    - audio_path: Path to the audio file
    - target_start_sec: Rough area near the beginning where you want to loop back to
    - target_end_sec: Rough area near the end where you want the loop to trigger
    - window_sec: Size of the comparison anchor window in seconds (default 200ms)
    """
    # 1. Load audio (force mono for mathematical analysis)
    y, sr = librosa.load(audio_path, sr=None, mono=True)

    window_samples = int(window_sec * sr)

    # Define search bounds (give it a 1-second buffer around targets to find the best match)
    search_buffer = int(1.0 * sr)

    start_center = int(target_start_sec * sr)
    end_center = int(target_end_sec * sr)

    # 2. Extract the "Anchor" window from the end section
    anchor_start = end_center - (window_samples // 2)
    anchor_end = anchor_start + window_samples
    anchor = y[anchor_start:anchor_end]

    # Define the broad search area near the beginning
    search_start = max(0, start_center - search_buffer)
    search_end = min(len(y), start_center + search_buffer)
    search_area = y[search_start:search_end]

    # 3. Compute Normalized Cross-Correlation
    # Subtract means to ensure we correlate the actual AC signal shape, not DC offsets
    anchor_norm = anchor - np.mean(anchor)
    search_norm = search_area - np.mean(search_area)

    # Match filters using scipy's correlation
    corr = scipy.signal.correlate(search_norm, anchor_norm, mode='valid')

    # Find the coarse macro-match index
    best_match_idx_in_search = np.argmax(corr)
    macro_start_sample = search_start + best_match_idx_in_search
    macro_end_sample = anchor_start

    # 4. Micro-Alignment via Zero-Crossings
    # Find zero crossings where slope is positive (going up)
    def find_nearest_rising_zero(signal, target_idx):
        # Look within a small 30ms window around the target sample
        search_radius = int(0.03 * sr)
        start_look = max(0, target_idx - search_radius)
        end_look = min(len(signal) - 1, target_idx + search_radius)

        best_zero = target_idx
        min_dist = float('inf')

        for i in range(start_look, end_look):
            # Check for zero crossing (sign change) AND rising slope
            if signal[i] <= 0 and signal[i+1] > 0:
                dist = abs(i - target_idx)
                if dist < min_dist:
                    min_dist = dist
                    best_zero = i
        return best_zero

    final_start_sample = find_nearest_rising_zero(y, macro_start_sample)
    final_end_sample = find_nearest_rising_zero(y, macro_end_sample)

    print("--- Optimization Complete ---")
    print(f"Sample Rate: {sr} Hz")
    print(f"Macro Match Sample -> Start: {macro_start_sample} | End: {macro_end_sample}")
    print(f"Zero-Cross Aligned -> Start: {final_start_sample} | End: {final_end_sample}")
    print(f"Precise Timestamps -> Start: {final_start_sample / sr:.4f}s | End: {final_end_sample / sr:.4f}s")
    print(f"Total Loop Duration: {(final_end_sample - final_start_sample) / sr:.4f}s")

    return final_start_sample, final_end_sample, y, sr

# --- Example Usage ---
if __name__ == "__main__":
    # Replace with your file path and rough targets
    # e.g., if it's an 8-bar loop, you want to jump from roughly 24.0s back to 4.0s
    file_path = "your_track.wav"
    t_start = 4.0
    t_end = 24.0

    try:
        loop_start, loop_end, audio_data, sample_rate = find_optimal_loop(file_path, t_start, t_end)

        # Optional: Slice out the perfect loop to export or test
        perfect_loop = audio_data[loop_start:loop_end]
        # sf.write('perfect_loop.wav', perfect_loop, sample_rate) # Requires soundfile library

    except FileNotFoundError:
        print(f"Please update the 'file_path' variable with a valid audio file.")
