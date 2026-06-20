import * as fs from 'fs';
import * as path from 'path';

function copyFolderSync(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

function deleteFolderRecursive(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

function movePath(srcRel: string, destRoot: string, projectRoot: string) {
  const srcAbs = path.join(projectRoot, srcRel);
  if (!fs.existsSync(srcAbs)) {
    console.log(`- Path does not exist, skipping: ${srcRel}`);
    return;
  }

  const destAbs = path.join(destRoot, srcRel);
  const destParent = path.dirname(destAbs);

  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  const stat = fs.lstatSync(srcAbs);
  if (stat.isFile()) {
    console.log(`Moving file: ${srcRel} -> dev_timeline/${srcRel}`);
    if (fs.existsSync(destAbs)) {
      fs.unlinkSync(destAbs);
    }
    fs.renameSync(srcAbs, destAbs);
  } else if (stat.isDirectory()) {
    console.log(`Moving directory: ${srcRel} -> dev_timeline/${srcRel}`);
    if (fs.existsSync(destAbs)) {
      deleteFolderRecursive(destAbs);
    }
    copyFolderSync(srcAbs, destAbs);
    deleteFolderRecursive(srcAbs);
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const destRoot = path.join(projectRoot, 'dev_timeline');

  if (!fs.existsSync(destRoot)) {
    fs.mkdirSync(destRoot, { recursive: true });
  }

  const pathsToMove = [
    // Top-level markdown reports and JSON traces
    'CLAIM4_TRACE_REPORT.md',
    'FAILURE_BREAKDOWN.md',
    'FINAL_RUN_REPORT.md',
    'IMAGE_PAYLOAD_REPORT.md',
    'OLLAMA_DEBUG_REPORT.md',
    'OPTIMIZATION_RECOMMENDATIONS.md',
    'PERFORMANCE_REPORT.md',
    'PERFORMANCE_TRACE.md',
    'PHASE2_REVIEW.md',
    'PHASE2_SUMMARY.md',
    'PHASE3_ARCHITECTURE.md',
    'PHASE3_LEARNINGS.md',
    'PHASE3_NEXT_STEPS.md',
    'PHASE3_SUMMARY.md',
    'PHASE4_LEARNINGS.md',
    'PHASE4_NEXT_STEPS.md',
    'PHASE4_ROOT_CAUSE_ANALYSIS.md',
    'PHASE4_SUMMARY.md',
    'PROMPT_TOKEN_ANALYSIS.md',
    'QWEN_OPTIMIZATION_REPORT.md',
    'QWEN_REQUEST_ANALYSIS.md',
    'RESOLUTION_SWEEP_REPORT.md',
    'raw_ollama_response.json',
    'raw_run2_response.json',
    'raw_run3_response.json',

    // Folders
    '.agents',
    'code/.cache',

    // Nested files in evaluation or code
    'evaluation/evaluation_report.md',
    'code/AGENTS.md',
    'code/CLAUDE.md',
    'code/problem_statement.md',
    'code/raw_ollama_response.json',
    'code/raw_run2_response.json',
    'code/raw_run3_response.json',
    'code/src/evaluation/test-prompt.ts',
    'code/src/evaluation/test-prompt-options.ts'
  ];

  console.log('Moving development artifacts to dev_timeline...');
  for (const relPath of pathsToMove) {
    movePath(relPath, destRoot, projectRoot);
  }
  console.log('All dev artifacts moved successfully.');
}

main();
