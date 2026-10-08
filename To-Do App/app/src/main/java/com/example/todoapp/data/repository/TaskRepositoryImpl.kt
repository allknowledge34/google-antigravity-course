package com.example.todoapp.data.repository

import com.example.todoapp.data.local.TaskDao
import com.example.todoapp.data.local.TaskEntity
import com.example.todoapp.domain.model.Priority
import com.example.todoapp.domain.model.Task
import com.example.todoapp.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val taskDao: TaskDao
) : TaskRepository {

    override fun getAllTasks(): Flow<List<Task>> {
        return taskDao.getAllTasks().map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getActiveTasks(): Flow<List<Task>> {
        return taskDao.getActiveTasks().map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getCompletedTasks(): Flow<List<Task>> {
        return taskDao.getCompletedTasks().map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getTaskById(taskId: Long): Flow<Task?> {
        return taskDao.getTaskById(taskId).map { it?.toDomainModel() }
    }

    override fun searchTasks(query: String): Flow<List<Task>> {
        return taskDao.searchTasks(query).map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getTasksByPriority(priority: Priority): Flow<List<Task>> {
        return taskDao.getTasksByPriority(priority).map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getTasksByCategory(category: String): Flow<List<Task>> {
        return taskDao.getTasksByCategory(category).map { entities -> entities.map { it.toDomainModel() } }
    }

    override fun getTasksByDueDate(): Flow<List<Task>> {
        return taskDao.getTasksByDueDate().map { entities -> entities.map { it.toDomainModel() } }
    }

    override suspend fun insertTask(task: Task): Long {
        return taskDao.insertTask(task.toEntity())
    }

    override suspend fun updateTask(task: Task) {
        taskDao.updateTask(task.toEntity())
    }

    override suspend fun deleteTask(task: Task) {
        taskDao.deleteTask(task.toEntity())
    }

    override suspend fun updateTaskCompletion(taskId: Long, isCompleted: Boolean, updatedAt: Long) {
        taskDao.updateTaskCompletion(taskId, isCompleted, updatedAt)
    }
}

fun TaskEntity.toDomainModel(): Task {
    return Task(
        id = id,
        title = title,
        description = description,
        isCompleted = isCompleted,
        priority = priority,
        category = category,
        dueDate = dueDate,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun Task.toEntity(): TaskEntity {
    return TaskEntity(
        id = id,
        title = title,
        description = description,
        isCompleted = isCompleted,
        priority = priority,
        category = category,
        dueDate = dueDate,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
