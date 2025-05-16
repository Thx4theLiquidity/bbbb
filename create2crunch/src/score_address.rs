pub fn score_address(address: &[u8]) -> i32 {
    // Convert the address bytes to a fixed array of nibbles
    let mut nibbles = [0u8; 40]; // An Ethereum address has 20 bytes, hence 40 nibbles
    for (i, &byte) in address.iter().enumerate() {
        nibbles[2 * i] = byte >> 4;      // High nibble
        nibbles[2 * i + 1] = byte & 0x0F; // Low nibble
    }

    let mut score: i32 = 0;

    // 1. Count Leading Zero Nibbles
    let leading_zero_nibbles = nibbles.iter().take_while(|&&n| n == 0).count();

    // 2. Strict Check for Minimum Leading Zeros (3 bytes = 6 nibbles)
    if leading_zero_nibbles < 6 {
        return 0; // Address does not meet the fundamental prefix requirement
    }
    score += 50; // Base score for meeting the 0x000000 prefix

    // 3. Score Consecutive 'B's (0xb) Immediately After Leading Zeros
    let mut current_nibble_idx = leading_zero_nibbles;
    let mut consecutive_b_count = 0;
    while current_nibble_idx < nibbles.len() && nibbles[current_nibble_idx] == 0xb {
        consecutive_b_count += 1;
        current_nibble_idx += 1;
    }

    if consecutive_b_count >= 4 {
        score += 200; // Significant bonus for achieving at least "BBBB" structure
        score += (4 * 100) as i32; // Points for the first 4 'B's in this sequence
        if consecutive_b_count > 4 {
            let extra_bs_in_sequence = consecutive_b_count - 4;
            score += (extra_bs_in_sequence * 250) as i32; // Higher points for 'B's beyond the 4th
        }
    } else if consecutive_b_count > 0 { // Some 'B's, but fewer than 4 (1 to 3)
        score += (consecutive_b_count * 25) as i32; // Smaller reward
    }

    // 4. Score Remaining 'B's (0xb) Elsewhere in the Address
    // current_nibble_idx is now at the position *after* the leading zeros and the primary consecutive 'B' sequence
    let mut remaining_b_nibbles = 0;
    if current_nibble_idx < nibbles.len() { // Ensure we don't go out of bounds
        for i in current_nibble_idx..nibbles.len() {
            if nibbles[i] == 0xb {
                remaining_b_nibbles += 1;
            }
        }
    }
    score += (remaining_b_nibbles * 15) as i32; // Moderate reward for additional 'B's

    score
}

