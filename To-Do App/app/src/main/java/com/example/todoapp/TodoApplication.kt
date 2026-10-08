package com.example.todoapp

import android.app.Application
import androidx.room.Room
import com.example.todoapp.data.local.TodoDatabase
import com.example.todoapp.data.repository.TaskRepositoryImpl
import com.example.todoapp.domain.repository.TaskRepository

class TodoApplication : Application() {
    lateinit var database: TodoDatabase
        private set
    
    lateinit var repository: TaskRepository
        private set
        
    override fun onCreate() {
        super.onCreate()
        database = Room.databaseBuilder(
            this,
            TodoDatabase::class.java,
            "todo_database"
        ).build()
        
        repository = TaskRepositoryImpl(database.taskDao())
    }
}
