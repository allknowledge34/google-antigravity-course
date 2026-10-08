package com.example.todoapp.data.local

import androidx.room.TypeConverter
import com.example.todoapp.domain.model.Priority

class Converters {
    @TypeConverter
    fun fromPriority(priority: Priority): String {
        return priority.name
    }

    @TypeConverter
    fun toPriority(name: String): Priority {
        return Priority.valueOf(name)
    }
}
