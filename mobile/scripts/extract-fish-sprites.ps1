Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot '..\assets\garden\water\fish_overlay.png'
$outputDirectory = Join-Path $PSScriptRoot '..\assets\garden\water\fish-groups'
$source = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $sourcePath))

$groups = @(
  @{ Name = 'fish_group_01.png'; X = 340; Y = 180; Width = 130; Height = 90 },
  @{ Name = 'fish_group_02.png'; X = 480; Y = 410; Width = 125; Height = 90 },
  @{ Name = 'fish_group_03.png'; X = 335; Y = 525; Width = 125; Height = 90 },
  @{ Name = 'fish_group_04.png'; X = 970; Y = 640; Width = 120; Height = 100 },
  @{ Name = 'fish_group_05.png'; X = 1145; Y = 825; Width = 130; Height = 105 }
)

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

try {
  foreach ($group in $groups) {
    $rectangle = [System.Drawing.Rectangle]::new(
      $group.X, $group.Y, $group.Width, $group.Height
    )
    $sprite = $source.Clone($rectangle, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $destination = Join-Path $outputDirectory $group.Name
      $sprite.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output "$($group.Name): source=($($group.X),$($group.Y)) size=$($group.Width)x$($group.Height)"
    } finally {
      $sprite.Dispose()
    }
  }
} finally {
  $source.Dispose()
}
