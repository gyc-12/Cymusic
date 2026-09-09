# 已执行的旧任务材料整理

2026-09-09，依据用户“废弃逐版本升级任务、不写入 Changelog、可保留有用成果”的要求执行。

**已移出项目**

原任务 `research/` 下以 `sdk51-` 至 `sdk57-` 开头的旧研究文件/目录，以及 `incremental-checkpoint-20260908` 旧计划，共 61 项。移动前它们都未被 Git 追踪，涉及 66,367 个未忽略文件、1,161,724,182 字节。

本地备份根目录：

```text
/Users/gyc/Code/Cymusic-upgrade-backup-20260905-Bq7oFo/
  retired-incremental-materials-20260909/
    research/<原文件或目录名>
    active-records-before-reassessment/<整理前的当前任务文档>
```

旧文档中的 `research/<名称>` 若指向被移走的材料，以这个备份前缀替换即可恢复查阅。全部 61 项的原路径、备份相对路径和统计见 [retired-materials.csv](retired-materials.csv)。操作清单另保存在项目外 `dependency-reassessment-20260909/cleanup-manifest.json`。

**继续保留的成果**

- 当前 APP 源码、7 个必需新增产品文件、有效补丁、原生工程与锁文件。
- `.trellis/spec/frontend/native-upgrade-contracts.md`：MMKV、文件路径与删除、Metro、图片与列表、分享和验收契约。
- 当前任务 `retained-findings.md`：精简的有用经验索引。
- `manual-acceptance-results.md`：用户 M01–M12 全部通过的结果，以及单独的未测范围。
- 当前直接目标的本地构建/数据/恢复证据；已有项目外旧数据恢复备份。
- 共享 `fixtures/`。部分旧编号保留，因为直接目标仍复用样本和协议，不表示这些升级任务继续有效。
- 原有 `00-bootstrap-guidelines`、用户的 `.idea` 删除及其他盘点前修改。

**Git 候选变化**

| 变化 | 文件数 |
| --- | ---: |
| 整理前未追踪候选 | 68,012 |
| 移出旧研究/计划 | −66,367 |
| 忽略其余原有本地研究证据 | −1,269 |
| 新增本次报告 12 个文件及经验索引 1 个 | +13 |
| 当前未追踪候选 | **389** |

根 `.gitignore` 仅新增了本任务 `research/` 的忽略项，报告在 `docs/audit/`、可复用契约在 `.trellis/spec/`，仍可正常加入 Git。该规则没有忽略应用源码或共享测试样本。

当前任务的 PRD、执行入口、handoff 和研究索引已更新，避免继续旧阶段任务或已消费的安装/恢复脚本。原文在项目外备份中保留。没有新增逐版本 Changelog、Git 提交或分支；追踪路径集合仍为 251 个。

`src.zip`、多平台工具配置等与旧升级路线无直接关联，本轮只在报告中列出处理建议，没有一并删除。
