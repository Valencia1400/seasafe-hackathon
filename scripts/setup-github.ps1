# Creates the private GitHub repo, pushes this folder, adds labels, milestones, issues and a project board.
# Run ONCE by the repo owner (Person 3 or 1) from the repo root:
#   gh auth login                      (interactive, in your own terminal - never paste tokens in chat)
#   gh auth refresh -s project         (needed only for the project board)
#   .\scripts\setup-github.ps1 -Owner <your-username-or-org>
# Nothing is invited or made public by this script. Repo is PRIVATE.

param(
  [Parameter(Mandatory = $true)][string]$Owner,
  [string]$Repo = "seasafe-hackathon"
)
$ErrorActionPreference = "Stop"
$full = "$Owner/$Repo"

gh auth status
if ($LASTEXITCODE -ne 0) { throw "Run 'gh auth login' first." }

# 1. Repo (private) + push all branches
gh repo view $full 2>$null
if ($LASTEXITCODE -eq 0) { throw "$full already exists - stopping so nothing is overwritten." }
gh repo create $full --private --source . --remote origin --push
foreach ($b in "feature/cad", "feature/electronics", "feature/dashboard") {
  git push -u origin $b
}

# 2. Labels
$labels = @{
  "CAD" = "1d76db"; "Electronics" = "fbca04"; "Software" = "0e8a16"; "Testing" = "5319e7";
  "Documentation" = "0075ca"; "Presentation" = "d876e3"; "Blocked" = "b60205";
  "Critical" = "e11d21"; "Stretch Goal" = "c5def5"
}
foreach ($k in $labels.Keys) { gh label create $k --color $labels[$k] --repo $full --force }

# 3. Milestones (due dates are end of each day)
$ms = @{ "Friday 13 Nov" = "2026-11-13T23:00:00Z"; "Saturday 14 Nov" = "2026-11-14T23:00:00Z"; "Sunday 15 Nov" = "2026-11-15T23:00:00Z" }
foreach ($k in $ms.Keys) {
  gh api "repos/$full/milestones" -f title="$k" -f due_on="$($ms[$k])" | Out-Null
}

# 4. Project board (optional; skipped if the 'project' scope is missing)
$projectNumber = $null
try {
  $p = gh project create --owner $Owner --title "SeaSafe Modular" --format json | ConvertFrom-Json
  $projectNumber = $p.number
  Write-Host "Project board: $($p.url)  (default statuses Todo / In Progress / Done)"
} catch { Write-Warning "Project board not created: run 'gh auth refresh -s project' and re-run only that part manually." }

# 5. Issues
$issues = Get-Content .github/issues.json -Raw | ConvertFrom-Json
foreach ($i in $issues) {
  $body = @"
**Task:** $($i.task)

**Responsible role:** $($i.role) _(placeholder until GitHub usernames are assigned)_
**Priority:** $($i.priority)
**Deadline / milestone:** $($i.milestone)
**Dependencies:** $($i.deps)

**Definition of Done:** $($i.dod)
"@
  $ghArgs = @("issue", "create", "--repo", $full, "--title", $i.title, "--body", $body, "--milestone", $i.milestone)
  foreach ($l in $i.labels) { $ghArgs += @("--label", $l) }
  $url = (& gh @ghArgs)
  Write-Host $url
  if ($projectNumber) { gh project item-add $projectNumber --owner $Owner --url $url | Out-Null }
}
Write-Host "Done. Repo: https://github.com/$full"
