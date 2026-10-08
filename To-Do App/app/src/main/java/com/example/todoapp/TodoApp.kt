package com.example.todoapp

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.todoapp.navigation.Screen
import com.example.todoapp.navigation.TodoNavGraph
import com.example.todoapp.ui.components.TodoBottomNavigation

@Composable
fun TodoApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val showFabAndBottomBar = currentRoute in listOf(
        Screen.Home.route,
        Screen.Tasks.route,
        Screen.Calendar.route
    )

    Scaffold(
        bottomBar = {
            if (showFabAndBottomBar) {
                TodoBottomNavigation(navController = navController)
            }
        },
        floatingActionButton = {
            if (showFabAndBottomBar) {
                FloatingActionButton(
                    onClick = {
                        navController.navigate(Screen.TaskEditor.createRoute())
                    }
                ) {
                    Icon(imageVector = Icons.Filled.Add, contentDescription = "Add Task")
                }
            }
        }
    ) { innerPadding ->
        TodoNavGraph(
            navController = navController,
            modifier = Modifier.padding(innerPadding)
        )
    }
}
