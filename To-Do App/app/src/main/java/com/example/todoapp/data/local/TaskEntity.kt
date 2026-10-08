package com.example.todoapp.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.Index
import com.example.todoapp.domain.model.Priority

@Entity(
    tableName = "tasks",
    indices = [
        Index(value = ["isCompleted"]),
        Index(value = ["priority"]),
        Index(value = ["category"]),
        Index(value = ["dueDate"])
    ]
)
data class TaskEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String,
    val isCompleted: Boolean,
    val priority: Priority,
    val category: String,
    val dueDate: Long?,
    val createdAt: Long,
    val updatedAt: Long
)
