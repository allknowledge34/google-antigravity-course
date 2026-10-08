package com.example.todoapp.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.todoapp.ui.calendar.CalendarScreen
import com.example.todoapp.ui.home.HomeScreen
import com.example.todoapp.ui.task.TaskEditorScreen
import com.example.todoapp.ui.task.TasksScreen
import com.example.todoapp.ui.task.TaskViewModel

@Composable
fun TodoNavGraph(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(navController = navController, startDestination = Screen.Home.route, modifier = modifier) {
        composable(Screen.Home.route) {
            val viewModel: TaskViewModel = androidx.lifecycle.viewmodel.compose.viewModel(factory = TaskViewModel.Factory)
            HomeScreen(viewModel = viewModel)
        }
        composable(Screen.Tasks.route) {
            val viewModel: TaskViewModel = androidx.lifecycle.viewmodel.compose.viewModel(factory = TaskViewModel.Factory)
            TasksScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.Calendar.route) {
            val viewModel: TaskViewModel = androidx.lifecycle.viewmodel.compose.viewModel(factory = TaskViewModel.Factory)
            CalendarScreen(viewModel = viewModel, navController = navController)
        }
        composable(Screen.TaskEditor.route + "?taskId={taskId}") { backStackEntry ->
            val viewModel: TaskViewModel = androidx.lifecycle.viewmodel.compose.viewModel(factory = TaskViewModel.Factory)
            val taskId = backStackEntry.arguments?.getString("taskId")?.toLongOrNull()
            TaskEditorScreen(viewModel = viewModel, navController = navController, taskId = taskId)
        }
    }
}
