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
        Migration {
            version: 6,
            description: "renumber_post_import_blocks",
            sql: include_str!("../migrations/006_renumber_post_import_blocks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "tune_top_set_reps",
            sql: include_str!("../migrations/007_tune_top_set_reps.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "archive_exercises",
            sql: include_str!("../migrations/008_archive_exercises.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "revise_wave_plan",
            sql: include_str!("../migrations/009_revise_wave_plan.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "complete_box_jump_pairing",
            sql: include_str!("../migrations/010_complete_box_jump_pairing.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "knee_resilience_revision",
            sql: include_str!("../migrations/011_knee_resilience_revision.sql"),
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
