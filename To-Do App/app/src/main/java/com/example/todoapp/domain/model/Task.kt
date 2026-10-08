package com.example.todoapp.domain.model

data class Task(
    val id: Long,
    val title: String,
    val description: String,
    val isCompleted: Boolean,
    val priority: Priority,
    val category: String,
    val dueDate: Long?,
    val createdAt: Long,
    val updatedAt: Long
)

enum class Priority {
    LOW,
    MEDIUM,
    HIGH
}
