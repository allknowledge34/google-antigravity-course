package com.example.todoapp.ui.task

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.example.todoapp.TodoApplication
import com.example.todoapp.domain.model.Priority
import com.example.todoapp.domain.model.Task
import com.example.todoapp.domain.repository.TaskRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class SortOrder {
    NEWEST,
    OLDEST,
    PRIORITY,
    DUE_DATE
}

enum class TaskFilter {
    ALL,
    ACTIVE,
    COMPLETED
}

data class FilterState(
    val status: TaskFilter = TaskFilter.ALL,
    val priority: Priority? = null,
    val category: String? = null
)

class TaskViewModel(
    private val repository: TaskRepository
) : ViewModel() {

    val tasks: StateFlow<List<Task>> = repository.getAllTasks()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val activeTasks: StateFlow<List<Task>> = repository.getActiveTasks()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val completedTasks: StateFlow<List<Task>> = repository.getCompletedTasks()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    private val _filterState = MutableStateFlow(FilterState())
    val filterState = _filterState.asStateFlow()

    private val _sortOrder = MutableStateFlow(SortOrder.NEWEST)
    val sortOrder = _sortOrder.asStateFlow()

    val filteredTasks = combine(
        tasks, _searchQuery, _filterState, _sortOrder
    ) { list, query, filter, sort ->
        var result = list

        if (query.isNotBlank()) {
            val q = query.lowercase()
            result = result.filter {
                it.title.lowercase().contains(q) ||
                it.description.lowercase().contains(q) ||
                it.category.lowercase().contains(q)
            }
        }

        result = when (filter.status) {
            TaskFilter.ALL -> result
            TaskFilter.ACTIVE -> result.filter { !it.isCompleted }
            TaskFilter.COMPLETED -> result.filter { it.isCompleted }
        }
        
        if (filter.priority != null) {
            result = result.filter { it.priority == filter.priority }
        }
        
        if (filter.category != null) {
            result = result.filter { it.category == filter.category }
        }

        result = when (sort) {
            SortOrder.NEWEST -> result.sortedByDescending { it.createdAt }
            SortOrder.OLDEST -> result.sortedBy { it.createdAt }
            SortOrder.PRIORITY -> result.sortedByDescending { it.priority.ordinal }
            SortOrder.DUE_DATE -> result.sortedWith(compareBy<Task> { it.dueDate == null }.thenBy { it.dueDate })
        }

        result
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val availableCategories = tasks.map { list ->
        list.map { it.category }.filter { it.isNotEmpty() }.distinct().sorted()
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    fun setSearchQuery(query: String) { _searchQuery.value = query }
    
    fun setFilterStatus(status: TaskFilter) { 
        _filterState.value = _filterState.value.copy(status = status) 
    }
    
    fun setFilterPriority(priority: Priority?) { 
        _filterState.value = _filterState.value.copy(priority = priority) 
    }
    
    fun setFilterCategory(category: String?) { 
        _filterState.value = _filterState.value.copy(category = category) 
    }
    
    fun setSortOrder(sort: SortOrder) { 
        _sortOrder.value = sort 
    }

    fun addTask(title: String, description: String, priority: Priority, category: String, dueDate: Long?) {
        val trimmedTitle = title.trim()
        if (trimmedTitle.isEmpty()) return

        val now = System.currentTimeMillis()
        val task = Task(
            id = 0,
            title = trimmedTitle,
            description = description.trim(),
            isCompleted = false,
            priority = priority,
            category = category.trim(),
            dueDate = dueDate,
            createdAt = now,
            updatedAt = now
        )
        viewModelScope.launch {
            repository.insertTask(task)
        }
    }

    fun updateTask(task: Task) {
        viewModelScope.launch {
            repository.updateTask(task.copy(updatedAt = System.currentTimeMillis()))
        }
    }

    fun deleteTask(task: Task) {
        viewModelScope.launch {
            repository.deleteTask(task)
        }
    }

    fun toggleTaskCompletion(task: Task) {
        viewModelScope.launch {
            repository.updateTaskCompletion(
                taskId = task.id,
                isCompleted = !task.isCompleted,
                updatedAt = System.currentTimeMillis()
            )
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
                val application = checkNotNull(extras[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]) as TodoApplication
                return TaskViewModel(application.repository) as T
            }
        }
    }
}
