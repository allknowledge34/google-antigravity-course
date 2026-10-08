package com.example.todoapp.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Tasks : Screen("tasks")
    object Calendar : Screen("calendar")
    object TaskEditor : Screen("task_editor") {
        fun createRoute(taskId: Long? = null): String {
            return if (taskId != null) "task_editor?taskId=$taskId" else "task_editor"
        }
    }
}
