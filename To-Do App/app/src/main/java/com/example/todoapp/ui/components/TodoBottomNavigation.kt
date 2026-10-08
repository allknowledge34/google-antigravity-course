package com.example.todoapp.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.example.todoapp.navigation.Screen

@Composable
fun TodoBottomNavigation(navController: NavHostController) {
    val items = listOf(
        Screen.Home,
        Screen.Tasks,
        Screen.Calendar
    )

    NavigationBar {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStackEntry?.destination?.route

        items.forEach { screen ->
            val isSelected = currentRoute == screen.route
            NavigationBarItem(
                icon = {
                    when (screen) {
                        Screen.Home -> Icon(imageVector = Icons.Filled.Home, contentDescription = "Home")
                        Screen.Tasks -> Icon(imageVector = Icons.Filled.List, contentDescription = "Tasks")
                        Screen.Calendar -> Icon(imageVector = Icons.Filled.DateRange, contentDescription = "Calendar")
                        else -> {}
                    }
                },
                label = {
                    when (screen) {
                        Screen.Home -> Text("Home")
                        Screen.Tasks -> Text("Tasks")
                        Screen.Calendar -> Text("Calendar")
                        else -> {}
                    }
                },
                selected = isSelected,
                onClick = {
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    }
}
