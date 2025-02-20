# 切换到提示词目录
Set-Location -Path "src/prompt/cn/funny"

# 定义重命名映射
$renameMap = @{
    "01态度出发.md" = "attitude_perspective.md"
    "02洞察观点.md" = "insight_viewpoint.md"
    "03解释.md" = "explanation.md"
    "05真诚困境.md" = "sincerity_dilemma.md"
    "06陌生场景.md" = "unfamiliar_scenario.md"
    "07视角转换.md" = "perspective_shift.md"
    "08类比创作.md" = "analogy_creation.md"
    "09what_if.md" = "what_if.md"
    "10场景化.md" = "scenario_based.md"
    "11场景化手段.md" = "scenario_techniques.md"
    "12光明面.md" = "bright_side.md"
    "13夸着骂.md" = "ironic_praise.md"
    "14类比式幽默.md" = "analogical_humor.md"
    "15谐音梗.md" = "homophonic_pun.md"
    "16自嘲式幽默.md" = "self_deprecating_humor.md"
    "17callback.md" = "callback.md"
    "18nba结构.md" = "nba_structure.md"
    "嘴替.md" = "mouth_substitute.md"
    "弱智吧.md" = "silly_style.md"
    "我很礼貌.md" = "polite_humor.md"
    "搞笑怪.md" = "funny_character.md"
    "这很合理.md" = "makes_sense.md"
}

# 执行重命名
foreach ($oldName in $renameMap.Keys) {
    $newName = $renameMap[$oldName]
    if (Test-Path $oldName) {
        Rename-Item -Path $oldName -NewName $newName
        Write-Host "已重命名: $oldName -> $newName" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $oldName" -ForegroundColor Yellow
    }
}

Write-Host "重命名完成！" -ForegroundColor Cyan 