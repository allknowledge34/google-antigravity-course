package com.example.todoapp.ui.calendar

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.todoapp.navigation.Screen
import com.example.todoapp.ui.components.TaskItem
import com.example.todoapp.ui.task.TaskViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.TimeZone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(viewModel: TaskViewModel, navController: NavController) {
    val tasks by viewModel.tasks.collectAsState()
    
    val tasksWithDueDate = tasks.filter { it.dueDate != null }.sortedBy { it.dueDate }
    val groupedTasks = tasksWithDueDate.groupBy { it.dueDate!! }
    val currentLocale = androidx.compose.ui.platform.LocalConfiguration.current.locales[0]

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        CenterAlignedTopAppBar(windowInsets = WindowInsets(0.dp),
            title = {
                Text(
                    text = "Calendar",
                    fontWeight = FontWeight.Bold
                )
            },
            colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                containerColor = MaterialTheme.colorScheme.background
            )
        )

        if (tasksWithDueDate.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize().weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No upcoming tasks.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                groupedTasks.forEach { (dateMillis, dayTasks) ->
                    item {
                        val formatter = SimpleDateFormat("EEEE, MMM dd, yyyy", currentLocale).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                        }
                        Text(
                            text = formatter.format(Date(dateMillis)),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 8.dp, top = 16.dp)
                        )
                    }
                    items(dayTasks, key = { it.id }) { task ->
                        TaskItem(
                            task = task,
                            onToggleCompletion = { viewModel.toggleTaskCompletion(task) },
                            onClick = { navController.navigate(Screen.TaskEditor.createRoute(task.id)) }
                        )
                    }
                }
            }
        }
    }
}
