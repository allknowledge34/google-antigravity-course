package com.example.todoapp.domain.repository

import com.example.todoapp.domain.model.Task
import com.example.todoapp.domain.model.Priority
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun getAllTasks(): Flow<List<Task>>
    fun getActiveTasks(): Flow<List<Task>>
    fun getCompletedTasks(): Flow<List<Task>>
    fun getTaskById(taskId: Long): Flow<Task?>
    fun searchTasks(query: String): Flow<List<Task>>
    fun getTasksByPriority(priority: Priority): Flow<List<Task>>
    fun getTasksByCategory(category: String): Flow<List<Task>>
    fun getTasksByDueDate(): Flow<List<Task>>
    
    suspend fun insertTask(task: Task): Long
    suspend fun updateTask(task: Task)
    suspend fun deleteTask(task: Task)
    suspend fun updateTaskCompletion(taskId: Long, isCompleted: Boolean, updatedAt: Long)
}
