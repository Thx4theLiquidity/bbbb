pub fn score_address(address: &[u8]) -> i32 {
    // Convert the address bytes to a fixed array of nibbles
    let mut nibbles = [0u8; 40]; // An Ethereum address has 20 bytes, hence 40 nibbles
    for (i, &byte) in address.iter().enumerate() {
        nibbles[2 * i] = byte >> 4;      // High nibble (top 4 bits)
        nibbles[2 * i + 1] = byte & 0x0F; // Low nibble (bottom 4 bits)
    }

    // Initialize total score
    let mut total_score = 0;

    // 1. Ten (10) points for every leading 0 nibble
    let leading_zeros_count = nibbles.iter().take_while(|&&n| n == 0).count();
    total_score += (leading_zeros_count * 10) as i32;

    // 2. Forty (40) points if the first non-zero nibble 'b' is followed by 3 more 'b's
    // 3. Twenty (20) points if the first nibble after these 4 'b's is NOT 'b'
    let start_idx = leading_zeros_count;
    if start_idx + 4 <= nibbles.len() && nibbles[start_idx..start_idx + 4] == [0xb, 0xb, 0xb, 0xb] {
        total_score += 40; // Found 'bbbb' sequence right after leading zeros
        if start_idx + 4 < nibbles.len() && nibbles[start_idx + 4] != 0xb {
            total_score += 20; // Next nibble after 'bbbb' is not 'b'
        }
    }

    // 4. Twenty (20) points if the last 4 nibbles are 'b's
    let nibble_count = nibbles.len();
    if nibble_count >= 4 && nibbles[nibble_count - 4..] == [0xb, 0xb, 0xb, 0xb] {
        total_score += 20;
    }

    // 5. One (1) point for every 'b' nibble
    let bs_count = nibbles.iter().filter(|&&n| n == 0xb).count();
    total_score += bs_count as i32;

    // total_score now holds the final calculated score
    total_score
}

