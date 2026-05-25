// Quick test to simulate what get_status() does in Tauri
// Run with: cargo script test_path.rs (or add to a test module)
fn main() {
    // Simulate git status --porcelain output
    let lines = vec![
        " M desktop/src-tauri/src/lib.rs",
        " M desktop/src/App.tsx",
        " D desktop/src/components/FilePreviewPanel.tsx",
        "?? desktop/src/components/CommitForm.tsx",
    ];

    for line in &lines {
        if line.len() < 4 {
            continue;
        }
        let index_char = line.chars().nth(0).unwrap_or(' ');
        let work_char = line.chars().nth(1).unwrap_or(' ');
        let raw_path = &line[3..];
        let mut file_path = raw_path.trim().to_string();

        if file_path.starts_with('"') && file_path.ends_with('"') && file_path.len() >= 2 {
            file_path = file_path[1..file_path.len() - 1].to_string();
        }

        println!("index='{}' work='{}' raw='{}' final_path='{}'", 
            index_char, work_char, raw_path, file_path);
        
        // Check byte values of first 5 chars
        let bytes: Vec<u8> = file_path.bytes().take(5).collect();
        println!("  First bytes: {:?}", bytes);
    }
}
