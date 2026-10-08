package com.example.todoapp.data.local

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.todoapp.domain.model.Priority
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class TaskDaoTest {

    private lateinit var database: TodoDatabase
    private lateinit var taskDao: TaskDao

    @Before
    fun createDb() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(
            context,
            TodoDatabase::class.java
        ).allowMainThreadQueries().build()
        taskDao = database.taskDao()
    }

    @After
    fun closeDb() {
        database.close()
    }

    @Test
    fun testEmptyDatabase() = runTest {
        val tasks = taskDao.getAllTasks().first()
        assertTrue(tasks.isEmpty())
    }

    @Test
    fun testInsertAndRead() = runTest {
        val task = TaskEntity(
            title = "Test Task",
            description = "Description",
            isCompleted = false,
            priority = Priority.HIGH,
            category = "Work",
            dueDate = null,
            createdAt = 1000L,
            updatedAt = 1000L
        )
        val id = taskDao.insertTask(task)
        
        val loaded = taskDao.getTaskById(id).first()
        assertEquals(task.title, loaded?.title)
    }

    @Test
    fun testUpdate() = runTest {
        val task = TaskEntity(
            title = "Old Title",
            description = "",
            isCompleted = false,
            priority = Priority.LOW,
            category = "",
            dueDate = null,
            createdAt = 0L,
            updatedAt = 0L
        )
        val id = taskDao.insertTask(task)
        
        val updatedTask = task.copy(id = id, title = "New Title")
        taskDao.updateTask(updatedTask)
        
        val loaded = taskDao.getTaskById(id).first()
        assertEquals("New Title", loaded?.title)
    }

    @Test
    fun testDelete() = runTest {
        val task = TaskEntity(
            title = "To Delete",
            description = "",
            isCompleted = false,
            priority = Priority.LOW,
            category = "",
            dueDate = null,
            createdAt = 0L,
            updatedAt = 0L
        )
        val id = taskDao.insertTask(task)
        val insertedTask = taskDao.getTaskById(id).first()!!
        
        taskDao.deleteTask(insertedTask)
        
        val loaded = taskDao.getTaskById(id).first()
        assertTrue(loaded == null)
    }

    @Test
    fun testCompletionUpdate() = runTest {
        val task = TaskEntity(
            title = "Complete Me",
            description = "",
            isCompleted = false,
            priority = Priority.LOW,
            category = "",
            dueDate = null,
            createdAt = 0L,
            updatedAt = 0L
        )
        val id = taskDao.insertTask(task)
        
        taskDao.updateTaskCompletion(id, true, 5000L)
        
        val loaded = taskDao.getTaskById(id).first()
        assertEquals(true, loaded?.isCompleted)
        assertEquals(5000L, loaded?.updatedAt)
    }

    @Test
    fun testSearch() = runTest {
        val task1 = TaskEntity(title = "Apples", description = "Buy apples", isCompleted = false, priority = Priority.LOW, category = "", dueDate = null, createdAt = 1L, updatedAt = 1L)
        val task2 = TaskEntity(title = "Bananas", description = "Buy bananas", isCompleted = false, priority = Priority.LOW, category = "", dueDate = null, createdAt = 2L, updatedAt = 2L)
        taskDao.insertTask(task1)
        taskDao.insertTask(task2)
        
        val results = taskDao.searchTasks("apple").first()
        assertEquals(1, results.size)
        assertEquals("Apples", results[0].title)
    }

    @Test
    fun testFilteringByCategory() = runTest {
        val task1 = TaskEntity(title = "Task 1", description = "", isCompleted = false, priority = Priority.LOW, category = "Work", dueDate = null, createdAt = 1L, updatedAt = 1L)
        val task2 = TaskEntity(title = "Task 2", description = "", isCompleted = false, priority = Priority.LOW, category = "Home", dueDate = null, createdAt = 2L, updatedAt = 2L)
        taskDao.insertTask(task1)
        taskDao.insertTask(task2)
        
        val results = taskDao.getTasksByCategory("Work").first()
        assertEquals(1, results.size)
        assertEquals("Work", results[0].category)
    }

    @Test
    fun testSortingAndMultipleTasks() = runTest {
        val task1 = TaskEntity(title = "Older", description = "", isCompleted = false, priority = Priority.LOW, category = "", dueDate = null, createdAt = 1000L, updatedAt = 1000L)
        val task2 = TaskEntity(title = "Newer", description = "", isCompleted = false, priority = Priority.LOW, category = "", dueDate = null, createdAt = 2000L, updatedAt = 2000L)
        taskDao.insertTask(task1)
        taskDao.insertTask(task2)
        
        val results = taskDao.getAllTasks().first()
        assertEquals(2, results.size)
        assertEquals("Newer", results[0].title)
        assertEquals("Older", results[1].title)
    }
}
