package com.example.todoapp.ui.task

import com.example.todoapp.domain.model.Priority
import com.example.todoapp.domain.model.Task
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TaskViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repository: FakeTaskRepository
    private lateinit var viewModel: TaskViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = FakeTaskRepository()
        viewModel = TaskViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `test filtering and sorting`() = runTest(testDispatcher) {
        val job = launch { viewModel.filteredTasks.collect() }
        
        // Add tasks
        repository.insertTask(Task(1, "Buy Milk", "", false, Priority.LOW, "Groceries", null, 1000, 1000))
        repository.insertTask(Task(2, "Buy Bread", "", true, Priority.HIGH, "Groceries", 5000, 2000, 2000))
        repository.insertTask(Task(3, "Read Book", "Sci-Fi", false, Priority.MEDIUM, "Leisure", 10000, 3000, 3000))
        
        advanceUntilIdle()

        // Default sort is NEWEST
        assertEquals(3, viewModel.filteredTasks.value.size)
        assertEquals("Read Book", viewModel.filteredTasks.value[0].title)
        
        // Test Sort by Priority
        viewModel.setSortOrder(SortOrder.PRIORITY)
        advanceUntilIdle()
        assertEquals("Buy Bread", viewModel.filteredTasks.value[0].title) // HIGH

        // Test Filter by Active
        viewModel.setFilterStatus(TaskFilter.ACTIVE)
        advanceUntilIdle()
        assertEquals(2, viewModel.filteredTasks.value.size) // Milk and Book

        // Test Search
        viewModel.setFilterStatus(TaskFilter.ALL)
        viewModel.setSearchQuery("Bread")
        advanceUntilIdle()
        assertEquals(1, viewModel.filteredTasks.value.size)
        assertEquals("Buy Bread", viewModel.filteredTasks.value[0].title)

        job.cancel()
    }
}
