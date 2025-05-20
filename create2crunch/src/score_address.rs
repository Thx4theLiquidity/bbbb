// Renaming the previous struct and function to avoid confusion if you want to switch back easily later.
// For now, we'll comment them out. If you are sure you don't need the 'B' logic, they can be deleted.
// #[derive(Debug)]
// pub struct ScoreBreakdown {
//     pub total_score: i32,
//     pub leading_b_count: usize,
//     pub extra_leading_b_count: usize, 
//     pub other_b_count: usize,
// }
// pub fn score_address_for_b(address: &[u8]) -> ScoreBreakdown { ... previous B logic ... }

#[derive(Debug)] // Add Debug for easier printing if needed
pub struct ScoreBreakdownZeros {
    pub total_score: i32,
    pub leading_zero_count: usize,
    pub extra_leading_zero_count: usize, // Number of leading Zeros beyond the initial 10
    pub other_zero_count: usize,
}

pub fn score_address(address: &[u8]) -> ScoreBreakdownZeros { // Changed return type
    // Convert the address bytes to a fixed array of nibbles
    let mut nibbles = [0u8; 40]; // An Ethereum address has 20 bytes, hence 40 nibbles
    for (i, &byte) in address.iter().enumerate() {
        nibbles[2 * i] = byte >> 4;      // High nibble
        nibbles[2 * i + 1] = byte & 0x0F; // Low nibble
    }

    let mut score: i32 = 0;
    let mut calculated_leading_zeros = 0;
    let mut calculated_extra_leading_zeros = 0;
    let mut calculated_other_zeros = 0;

    // 1. Count Leading '0' (0x0) Nibbles
    for i in 0..nibbles.len() {
        if nibbles[i] == 0x0 { // Target 0x0 now
            calculated_leading_zeros += 1;
        } else {
            break; // End of leading '0' sequence
        }
    }

    // 2. Strict Check for Minimum 10 Leading '0's
    if calculated_leading_zeros < 10 {
        return ScoreBreakdownZeros {
            total_score: 0,
            leading_zero_count: calculated_leading_zeros,
            extra_leading_zero_count: 0,
            other_zero_count: 0,
        };
    }
    score += 500; // Base score for meeting the 10 leading '0's requirement

    // 3. Score for Additional Leading '0's (beyond the first 10)
    if calculated_leading_zeros > 10 {
        calculated_extra_leading_zeros = calculated_leading_zeros - 10;
        score += (calculated_extra_leading_zeros * 300) as i32; // High reward for each extra leading '0'
    }

    // 4. Score Remaining '0's (0x0) Elsewhere in the Address
    // Start counting from the nibble *after* the leading '0' sequence
    if calculated_leading_zeros < nibbles.len() { // Ensure there are nibbles left to check
        for i in calculated_leading_zeros..nibbles.len() {
            if nibbles[i] == 0x0 { // Target 0x0 now
                calculated_other_zeros += 1;
            }
        }
    }
    score += (calculated_other_zeros * 25) as i32; // Moderate reward for other '0's

    ScoreBreakdownZeros {
        total_score: score,
        leading_zero_count: calculated_leading_zeros,
        extra_leading_zero_count: calculated_extra_leading_zeros,
        other_zero_count: calculated_other_zeros,
    }
}

