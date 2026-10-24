# Campus Navigation System

## What This App Does

The Campus Navigation System lets someone draw a school or campus map and find a walking route between important places.

You can add things such as:

- Walking paths
- Sidewalks
- Roads
- Buildings
- Trees
- Courts
- Doors and gates
- A starting point
- One or more destinations

After the map is ready, choose **Find Route**. The app shows how it searches the map and then displays the route it found.

## How The Map Works

Think of the map as a large sheet of square spaces.

Each square can be one of two things:

- A place where someone can walk
- A place that blocks walking

For example, a path, sidewalk, ground, door, or gate can be used. A wall, building, road, tree, or obstacle blocks the way.

When the app searches for a route, it checks the squares next to the current square. It can move up, right, down, or left. It does not move diagonally.

This makes the map behave like a connected set of spaces. The app follows the connections until it reaches the destination.

## Why The App Uses This Approach

A campus map is made of many connected locations. A person walking across campus also moves from one nearby location to another.

The app uses this same idea:

- Each walkable square is a possible place to stand.
- A connection means a person can walk from one square to the next.
- A blocked square cannot be entered.
- Some surfaces take more effort to cross than others.

This lets the app find routes in a way that matches how people move through a real campus.

## The Route Options

The app has three search options. They all look for a route, but they search in different ways.

### Depth-First Search

This option follows one direction as far as it can. If that direction does not work, it goes back and tries another direction.

It is similar to exploring a building hallway by hallway. It may find a route quickly, but the route may not be the shortest or easiest one.

### Breadth-First Search

This option checks nearby spaces first, then spaces a little farther away.

It is similar to spreading out from the starting point in circles. When every step has the same value, it usually finds the route with the fewest steps.

### Dijkstra's Algorithm

This option considers the effort needed to cross each type of surface.

For example:

- Paths, sidewalks, doors, and gates have a lower cost.
- Ground and courts have a higher cost.
- Walls, objects, and roads cannot be crossed.

This is the default option because it can find the least-cost route, not just a route with fewer squares.

## What The Search Animation Shows

When you press **Find Route**, the app first highlights the spaces it checks. These are the explored spaces.

After that, it highlights the route from the start to the destinations.

You can choose a slow, normal, or fast animation speed. You can also skip the animation and show the completed route immediately.

## The Main Parts Of The Screen

### Top Bar

The top bar contains the main controls:

- Choose a route method.
- Choose the animation speed.
- Find a route.
- Skip the animation.
- Clear the current route.
- Clear the map.
- Load the example school map.
- Save the current map.
- Load or delete a saved map.

### Tool List

The tool list is on the left side of the screen. Select a tool, then click or drag on the map.

The tools are grouped by purpose:

- Surfaces for paths, roads, sidewalks, and courts
- Barriers for walls and fences
- Openings for doors and gates
- Objects such as buildings, fountains, stages, and parking areas
- Small items such as trees, chairs, and obstacles
- Markers for the start point and destinations
- Extra tools for erasing and adding text labels

### Map Area

The map is in the center. You can pan around it and zoom in or out.

Clicking or dragging on the map changes the area according to the selected tool. Large objects can be drawn as rectangles.

### Information Panels

The information panels show the destinations, route details, and map legend. They help explain the colors and symbols shown on the map.

## Destinations

You can add more than one destination.

For each destination, you can:

- Include or exclude it from the route
- Change its order
- Change its color
- Move it to another square
- Remove it

The app visits selected destinations in the order shown in the destination list.

## Saving A Map

Press **Save Map** to save the current map. The app asks you to give it a name.

A saved map includes:

- The map surfaces
- Buildings and other objects
- The start point
- Destinations
- Text labels

To use a saved map later, choose it from the saved maps list and press **Load Saved**.

Saved maps are kept in this browser on this computer. They are not automatically shared with other people or other browsers. The app does not save the temporary route animation because that route can be calculated again from the map.

## The Example Map

Press **Load Sample** to restore the example school map. This gives you a ready-made map with paths, buildings, a road, a court, trees, and destinations.

Press **Clear Map** when you want to start a new map from an empty canvas.

## Undo

The app keeps recent map changes so you can press `Ctrl+Z` on Windows or `Command+Z` on macOS to undo an edit.

Undo applies to map changes such as painting cells, placing objects, moving destinations, and loading or clearing a map.

## In Short

The app turns a campus map into connected walkable spaces. It checks those spaces using the route method you choose, avoids blocked areas, considers surface difficulty when needed, and displays the route in an easy-to-follow animation.
