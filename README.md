# Blazor-ApexGrid

A Blazor wrapper for [apex-grid](https://www.npmjs.com/package/apex-grid), a Lit-based
web-component data grid. The core library (and its dependencies) are bundled into a single
self-contained ES module and shipped inside this package, so no `<script>` tag, CDN reference,
or npm build step is required in your app.

## Status

Early work in progress. The current release binds `Data` and `Columns` and renders the grid;
the data-pipeline features (sorting, filtering, paging, selection, editing) and events are
being added incrementally.

## Quick start

```razor
@using Blazor_ApexGrid.Components
@using Blazor_ApexGrid.Models

<ApexGrid TItem="Person" Data="people" Columns="columns" Height="360px" />

@code {
    private List<Person> people = new()
    {
        new() { Name = "Ada", Age = 36 },
        new() { Name = "Alan", Age = 41 },
    };

    private List<GridColumn<Person>> columns = new()
    {
        new() { Key = "name", HeaderText = "Name" },
        new() { Key = "age", HeaderText = "Age", Type = GridDataType.Number },
    };

    public class Person { public string Name { get; set; } = ""; public int Age { get; set; } }
}
```

Built on top of [apex-grid](https://www.npmjs.com/package/apex-grid) v3.3.0.
