use std::fs;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

// Store the pending file path until Angular is ready
struct PendingFile(Mutex<Option<String>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// Angular calls this once it's ready to receive the file
#[tauri::command]
fn get_pending_file(state: tauri::State<PendingFile>) -> Option<String> {
    let val = state.0.lock().unwrap().take();
    println!("GET PENDING FILE CALLED, returning: {:?}", val);
    val
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(PendingFile(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            // Second instance: emit directly (window is already running)
            if let Some(path) = args.get(1) {
                app.emit("open-file", path).ok();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            save_file,
            read_file,
            get_pending_file
        ])
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap();
            println!("CWD: {:?}", cwd); // ← see what dir the exe thinks it's in

            let file_path = args
                .iter()
                .skip(1)
                .find(|a| !a.starts_with("--") && !a.starts_with("tauri://"));

            if let Some(path) = file_path {
                let p = std::path::Path::new(path);

                // If already absolute, use as-is. If relative, join with cwd.
                let absolute = if p.is_absolute() {
                    p.to_path_buf()
                } else {
                    cwd.join(p)
                };

                println!("RESOLVED PATH: {:?}", absolute);
                println!("EXISTS: {}", absolute.exists()); // ← confirm file is found

                *app.state::<PendingFile>().0.lock().unwrap() =
                    Some(absolute.to_string_lossy().to_string());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
