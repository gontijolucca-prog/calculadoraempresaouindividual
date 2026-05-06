// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::WebviewUrl;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let _window = tauri::window::WindowBuilder::new(
                app,
                "main",
                WebviewUrl::App("https://gontijolucca-prog.github.io/calculadoraempresaouindividual/".parse().unwrap()),
            )
            .title("Recofátima Simuladores")
            .inner_size(1280.0, 800.0)
            .resizable(true)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
