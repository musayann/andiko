use tauri::{
    menu::{Menu, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};
use tauri_plugin_deep_link::DeepLinkExt;

mod store;

/// A menu entry the page reacts to (see useMenuEvents in packages/editor/src/desktop/desktop-shell.tsx).
/// Tab shortcuts live here, not in JS, because the default "Close Window" item
/// would otherwise take Cmd+W before the page ever sees it.
fn item(app: &AppHandle, id: &str, label: &str, accelerator: &str) -> tauri::Result<tauri::menu::MenuItem<Wry>> {
    MenuItemBuilder::with_id(id, label).accelerator(accelerator).build(app)
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let app_menu = SubmenuBuilder::new(app, "Andiko")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let mut file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new-tab", "New Document", "CmdOrCtrl+T")?)
        .item(&item(app, "open-link", "Open Shared Link…", "CmdOrCtrl+L")?)
        .separator()
        .item(&item(app, "close-tab", "Close Tab", "CmdOrCtrl+W")?)
        .item(&item(app, "close-window", "Close Window", "CmdOrCtrl+Shift+W")?);
    file = file.separator().item(&item(app, "print", "Print…", "CmdOrCtrl+P")?);
    let file = file.build()?;

    // No Undo/Redo here: a native Cmd+Z would bypass the editor's own history.
    let edit = SubmenuBuilder::new(app, "Edit")
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let mut tabs = SubmenuBuilder::new(app, "Tabs")
        .item(&item(app, "next-tab", "Next Tab", "CmdOrCtrl+Shift+]")?)
        .item(&item(app, "previous-tab", "Previous Tab", "CmdOrCtrl+Shift+[")?)
        .separator();
    for n in 1..=9 {
        tabs = tabs.item(&item(app, &format!("select-tab-{n}"), &format!("Tab {n}"), &format!("CmdOrCtrl+{n}"))?);
    }
    let tabs = tabs.build()?;

    let view = SubmenuBuilder::new(app, "View").fullscreen().build()?;
    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;

    Menu::with_items(app, &[&app_menu, &file, &edit, &tabs, &view, &window])
}

/// Opens the system print dialog for the page, whose PDF button saves offline.
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            print_page,
            store::store_load,
            store::store_get,
            store::store_write
        ])
        .setup(|app| {
            let handle = app.handle();
            app.manage(store::open(handle)?);
            app.set_menu(build_menu(handle)?)?;

            // andiko:// links open in a tab (see useDeepLinks in packages/editor/src/desktop/desktop-shell.tsx);
            // the window comes forward for them, even when minimized
            let handle = handle.clone();
            app.deep_link().on_open_url(move |_| {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            });
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            if id == "close-window" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
            } else {
                let _ = app.emit("menu", id);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Andiko");
}
