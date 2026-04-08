use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[tauri::command]
fn haptic_feedback(style: String) {
    let _ = style;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "security_hardening",
            sql: include_str!("../migrations/002_security_hardening.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "body_weight_log",
            sql: include_str!("../migrations/003_body_weight_log.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "fix_deload_percentages",
            sql: include_str!("../migrations/004_fix_deload_percentages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "fix_wave_percentages",
            sql: include_str!("../migrations/005_fix_wave_percentages.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:forge.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![haptic_feedback])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
