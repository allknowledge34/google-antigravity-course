package com.example.todoapp.ui.task

import com.example.todoapp.domain.model.Priority
import com.example.todoapp.domain.model.Task
import com.example.todoapp.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

class FakeTaskRepository : TaskRepository {
    private val _tasks = MutableStateFlow<List<Task>>(emptyList())
    
    override fun getAllTasks(): Flow<List<Task>> = _tasks

    override fun getActiveTasks(): Flow<List<Task>> = _tasks.map { list -> list.filter { !it.isCompleted } }

    override fun getCompletedTasks(): Flow<List<Task>> = _tasks.map { list -> list.filter { it.isCompleted } }

    override fun getTaskById(taskId: Long): Flow<Task?> = _tasks.map { list -> list.find { it.id == taskId } }

    override fun searchTasks(query: String): Flow<List<Task>> = _tasks.map { list -> 
        list.filter { it.title.contains(query, ignoreCase = true) || it.description.contains(query, ignoreCase = true) }
    }

    override fun getTasksByPriority(priority: Priority): Flow<List<Task>> = _tasks.map { list -> list.filter { it.priority == priority } }

    override fun getTasksByCategory(category: String): Flow<List<Task>> = _tasks.map { list -> list.filter { it.category == category } }

    override fun getTasksByDueDate(): Flow<List<Task>> = _tasks.map { list -> list.filter { it.dueDate != null }.sortedBy { it.dueDate } }

    private var nextId = 1L

    override suspend fun insertTask(task: Task): Long {
        val idToUse = if (task.id == 0L) nextId++ else task.id
        val newTask = task.copy(id = idToUse)
        _tasks.update { it + newTask }
        return idToUse
    }

    override suspend fun updateTask(task: Task) {
        _tasks.update { list ->
            list.map { if (it.id == task.id) task else it }
        }
    }

    override suspend fun deleteTask(task: Task) {
        _tasks.update { list ->
            list.filter { it.id != task.id }
        }
    }

    override suspend fun updateTaskCompletion(taskId: Long, isCompleted: Boolean, updatedAt: Long) {
        _tasks.update { list ->
            list.map { if (it.id == taskId) it.copy(isCompleted = isCompleted, updatedAt = updatedAt) else it }
        }
    }
}
