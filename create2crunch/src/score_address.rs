#[derive(Debug)] // Add Debug for easier printing if needed
pub struct ScoreBreakdown {
    pub total_score: i32,
    pub leading_b_count: usize,
    pub extra_leading_b_count: usize, // Number of leading Bs beyond the initial 10
    pub other_b_count: usize,
}

pub fn score_address(address: &[u8]) -> ScoreBreakdown {
    // Convert the address bytes to a fixed array of nibbles
    let mut nibbles = [0u8; 40]; // An Ethereum address has 20 bytes, hence 40 nibbles
    for (i, &byte) in address.iter().enumerate() {
        nibbles[2 * i] = byte >> 4;      // High nibble
        nibbles[2 * i + 1] = byte & 0x0F; // Low nibble
    }

    let mut score: i32 = 0;
    let mut calculated_leading_b_nibbles = 0;
    let mut calculated_extra_leading_bs = 0;
    let mut calculated_other_b_nibbles = 0;

    // 1. Count Leading 'B' (0xb) Nibbles
    for i in 0..nibbles.len() {
        if nibbles[i] == 0xb {
            calculated_leading_b_nibbles += 1;
        } else {
            break; // End of leading 'B' sequence
        }
    }

    // 2. Strict Check for Minimum 10 Leading 'B's
    if calculated_leading_b_nibbles < 10 {
        return ScoreBreakdown {
            total_score: 0,
            leading_b_count: calculated_leading_b_nibbles, // still report how many were found
            extra_leading_b_count: 0,
            other_b_count: 0, // No need to count others if prefix fails
        };
    }
    score += 500; // Base score for meeting the 10 leading 'B's requirement

    // 3. Score for Additional Leading 'B's (beyond the first 10)
    if calculated_leading_b_nibbles > 10 {
        calculated_extra_leading_bs = calculated_leading_b_nibbles - 10;
        score += (calculated_extra_leading_bs * 300) as i32; // High reward for each extra leading 'B'
    }

    // 4. Score Remaining 'B's (0xb) Elsewhere in the Address
    // Start counting from the nibble *after* the leading 'B' sequence
    if calculated_leading_b_nibbles < nibbles.len() { // Ensure there are nibbles left to check
        for i in calculated_leading_b_nibbles..nibbles.len() {
            if nibbles[i] == 0xb {
                calculated_other_b_nibbles += 1;
            }
        }
    }
    score += (calculated_other_b_nibbles * 25) as i32; // Moderate reward for other 'B's

    ScoreBreakdown {
        total_score: score,
        leading_b_count: calculated_leading_b_nibbles,
        extra_leading_b_count: calculated_extra_leading_bs,
        other_b_count: calculated_other_b_nibbles,
    }
}

