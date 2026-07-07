using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blazor_ApexGrid.Internal;

/// <summary>
/// System.Text.Json configuration for serializing grid data, columns, and config to the JSON shape
/// the apex-grid web component expects (camelCase keys, enums as camelCase strings, nulls omitted).
/// </summary>
public static class GridSerializer
{
    /// <summary>Shared serializer options used for every payload set on the element.</summary>
    public static readonly JsonSerializerOptions Default = Build();

    private static JsonSerializerOptions Build()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    /// <summary>Serializes a value to JSON using <see cref="Default"/>.</summary>
    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Default);
}
