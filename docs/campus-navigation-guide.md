# Campus Navigation System Guide

## Purpose

This document explains why the Campus Navigation System uses a graph data structure, which route algorithms it supports, where those parts are implemented, and how the main UI and application functions work.

## Why A Graph Is Used

The map is a navigation problem. The application needs to answer this question:

> Starting from one cell, which walkable cells can be visited to reach a destination with the lowest cost or the desired search behavior?

A graph is a natural model for this problem because it represents:

- **Vertices:** walkable map cells such as ground, paths, sidewalks, pedestrian lanes, courts, doors, and gates.
- **Edges:** legal moves between neighboring walkable cells.
- **Blocked vertices:** roads, walls, fences, trees, chairs, obstacles, and placed objects that cannot be entered.
- **Edge or movement costs:** normal walking surfaces cost `1`, while ground and courts cost `3`. Entering the final destination costs `1`.

The project uses an **implicit grid graph**. There is no separate `Graph` class or adjacency-list object. The two-dimensional `Grid` array is the graph storage, and neighboring cells are calculated when the algorithm needs them.

This approach fits the application because the map is already a rectangular grid. It avoids storing thousands of duplicate edge objects and makes editing straightforward: changing a cell type immediately changes whether that vertex is walkable and what it costs.

The core map and cell types are defined near the top of [app/page.tsx](../app/page.tsx#L6-L55). Walkability and movement costs are defined in [app/page.tsx](../app/page.tsx#L245-L280).

## How The Graph Is Built During Search

### 1. The map is stored as a grid

`Grid` is a two-dimensional array of `CellType` values. Each coordinate is represented by a `Point` with `x` and `y` values.

The helper `key` converts a point to a numeric index for visited, parent, distance, and completion arrays. `toPoint` converts the numeric index back into coordinates.

See [app/page.tsx](../app/page.tsx#L245-L248).

### 2. Walkability determines which vertices can be entered

The `WALKABLE` set contains the cell types that can be used by a route. `isWalkable` checks membership in that set.

Blocked cells remain visible on the map, but the search does not add them as neighbors. This means the UI map and the graph use the same source of truth.

See [app/page.tsx](../app/page.tsx#L252-L256).

### 3. Neighbor lookup creates graph edges

`getNeighbors` checks the four cardinal directions:

- Up
- Right
- Down
- Left

It rejects cells outside the computed search bounds and rejects blocked cells. The remaining cells are the current vertex's outgoing edges.

The search bounds are calculated by `getSearchBounds`. They cover the start, selected destinations, edited terrain, object footprints, and a one-cell margin. This prevents the algorithms from exploring the unused area of the 500 by 500 canvas.

See [app/page.tsx](../app/page.tsx#L286-L355).

### 4. Objects are applied to an effective search grid

Large objects are stored separately as `PlacedObject` records so the UI can render them as rectangles. Before routing, `buildEffectiveGrid` overlays those objects onto a copy of the terrain grid as blocked `object` cells.

Doors and gates are preserved as walkable openings even when they overlap an object footprint.

See [app/page.tsx](../app/page.tsx#L361-L373).

## Algorithms Used

The algorithm is selected in the header by the `algorithm` state. The available options are DFS, BFS, and Dijkstra's algorithm.

### Depth-First Search, DFS

DFS uses a stack. It follows one available branch as far as possible before backtracking.

Characteristics:

- Does not guarantee the cheapest route.
- Can explore a long winding route before finding the destination.
- Useful for demonstrating depth-first exploration.
- Uses the neighbor order supplied by `getNeighbors`.

Implementation: [app/page.tsx](../app/page.tsx#L377-L407).

### Breadth-First Search, BFS

BFS uses a queue. It visits all cells at distance one from the start, then all cells at distance two, and so on.

Characteristics:

- Finds a route with the fewest cell moves when every move has equal cost.
- Does not account for terrain costs of `1` versus `3`.
- Makes the expanding search frontier easy to visualize.

Implementation: [app/page.tsx](../app/page.tsx#L409-L439).

### Dijkstra's Algorithm

Dijkstra's algorithm tracks the current lowest known cost for every reachable cell. It repeatedly selects the unfinished cell with the smallest known distance and relaxes its neighbors.

Characteristics:

- Finds the lowest-cost route when movement costs are non-negative.
- Accounts for the difference between paths, sidewalks, doors, gates, ground, and courts.
- Is the default algorithm in the UI.
- Uses a simple array for the open set. It scans that array to find the lowest-distance cell instead of using a binary heap.

The cost calculation uses `stepCost`, which calls `cellCost` for the terrain type.

Implementation: [app/page.tsx](../app/page.tsx#L442-L480).

## Route Planning Across Multiple Destinations

The `findRoute` function coordinates the complete routing workflow:

1. Validates that a start point exists.
2. Collects selected destinations.
3. Builds the effective grid with placed objects included.
4. Computes search bounds.
5. Chooses DFS, BFS, or Dijkstra based on the selected algorithm.
6. Runs one search from the start to the first selected destination.
7. Runs another search from each reached destination to the next selected destination.
8. Combines the route cells and explored cells into one result.
9. Stores the route, cost, step count, order, and unreachable destinations in React state.
10. Starts the exploration and walking animation.

Destinations are visited in their current list order. The destination controls allow users to select, deselect, reorder, recolor, move, or remove destinations.

Implementation: [app/page.tsx](../app/page.tsx#L890-L956).

## UI Structure

### Header

The header contains the main route controls:

- Algorithm selector
- Animation speed selector
- Find Route
- Skip Animation
- Clear Route
- Clear Map
- Load Sample
- Save Map
- Saved map selector
- Load Saved
- Delete Saved

The header JSX is in [app/page.tsx](../app/page.tsx#L1220-L1310).

### Tool sidebar

The left sidebar is generated from `TOOL_GROUPS`. Tools are grouped into:

- Surfaces
- Barriers and openings
- Objects
- Small items
- Markers and tools

Selecting a tool changes how clicks and drags on the map are interpreted. The tool definitions are in [app/page.tsx](../app/page.tsx#L75-L119), and the sidebar rendering is in [app/page.tsx](../app/page.tsx#L1312-L1340).

### Map canvas

The central map is rendered as an SVG. The visible portion is calculated from the current pan, zoom, and container size so the app does not render every cell at once.

Each cell is rendered by `renderCell`. It draws the base color, grid border, path styling, road markings, crosswalk stripes, fences, gates, and small item icons.

Large placed objects are rendered by `renderObject` using their stored position, width, height, fill, stroke, and icon.

See [app/page.tsx](../app/page.tsx#L1029-L1160) for cell and object rendering, and [app/page.tsx](../app/page.tsx#L1180-L1220) for viewport calculations.

### Destination and route panels

The right side of the interface displays destination management, route details, and the legend. These panels expose the current route order, destination status, route cost, explored cell count, and visual meanings for map colors.

The route visualization uses separate arrays for explored cells and route cells. During the explore phase, explored cells are revealed progressively. During the walk phase, route cells are revealed progressively.

## Editing Functions

The map editor supports terrain painting, rectangle drawing, object placement, markers, labels, moving destinations, and erasing.

Important editing functions include:

- `clearMap`: resets the map to an empty grid and removes objects, markers, labels, and destinations.
- `loadSample`: restores the built-in school map.
- `renderCell`: draws each terrain cell.
- `renderObject`: draws a placed object.
- `pushHistory`: stores the current editable map state for undo support.

The editing state and undo history are defined inside the `Home` component in [app/page.tsx](../app/page.tsx#L485-L585). The reset and sample functions are in [app/page.tsx](../app/page.tsx#L959-L987).

## Saving And Loading Maps

Saved maps use browser `localStorage`. This is appropriate for the current client-side application because the map is edited in the browser and can be restored on the same browser later.

A saved map contains:

- Terrain grid
- Start point
- Destinations
- Text labels
- Placed objects

It does not save temporary route animation state. A loaded map starts without an active route, which avoids restoring stale search results after the map has changed.

The saved map key is `campus-nav-saved-maps`. The implementation is in:

- Storage hydration and persistence: [app/page.tsx](../app/page.tsx#L515-L555)
- Snapshot creation and save: [app/page.tsx](../app/page.tsx#L984-L1002)
- Loading a saved map: [app/page.tsx](../app/page.tsx#L1004-L1020)
- Deleting a saved map: [app/page.tsx](../app/page.tsx#L1021-L1027)

The current implementation stores data in browser storage rather than `app/store/data.json`. A browser client cannot safely write to a project file at runtime. A JSON file would require a server-side API or database endpoint to read and write data.

## Summary Of The Main Data Flow

```text
User edits the SVG map
        |
        v
React state stores grid, objects, labels, start, and destinations
        |
        v
Find Route creates an effective grid and search bounds
        |
        v
DFS, BFS, or Dijkstra calls getNeighbors to walk the implicit graph
        |
        v
The route result stores explored cells and route cells
        |
        v
The UI animates exploration and displays the final route
```

The main design choice is that the map editor and the pathfinding system share the same grid. The editor changes cell types and object footprints, while the graph search interprets those values as walkable vertices, blocked vertices, and movement costs.
