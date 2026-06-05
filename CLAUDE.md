# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpnf8ykk_w7fz score=5.3 created=2026-05-27 source=observation complexity=simple -->
- Always Read a file before editing it — even when the edit target seems obvious from context
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpnf8yn1_cmkr score=5.9 created=2026-05-27 source=anti_pattern complexity=simple -->
- Before committing any code change, run tsc --noEmit AND verify the production build succeeds — grep counts or partial checks are not sufficient.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mppi6d8y_3ecl score=5.1 created=2026-05-28 source=observation complexity=simple -->
- Before navigating to an external console (Firebase, GCP, etc.), read local config files first to confirm the correct project ID — use Bash to cat .firebaserc, firebase.json, and grep the SDK config in parallel
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpubmvep_yp25 score=7.7 created=2026-05-31 source=observation complexity=simple -->
- After rebuilding for a new preview server port, always kill the old vite preview process first (pkill -f 'vite preview') before spawning a new one to avoid port conflicts
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpubmvge_helb score=5.1 created=2026-05-31 source=anti_pattern complexity=simple -->
- Search for screenshot files with scoped find paths (project dir, then home dir) — never start from / root
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mq0oghsw_coqk score=5 created=2026-06-05 source=observation complexity=simple -->
- After taking a browser screenshot, immediately Read the saved file to visually verify its contents before proceeding to the next action
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mq0oghtq_ze4c score=5 created=2026-06-05 source=observation complexity=simple -->
- When verifying production UI across multiple document templates, test each template in sequence within the same browser session — navigate, screenshot, Read, then switch template and repeat
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mq0oocbw_tvsn score=5.4 created=2026-06-05 source=observation complexity=simple -->
- When testing a fallback/default UI state (e.g. logo fallback), clear the relevant localStorage key programmatically via browser_evaluate before navigating to the target page — do not rely on manual state or assume the app starts clean
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mq0ooccn_1qje score=7.6 created=2026-06-05 source=observation complexity=simple -->
- After committing, monitor the CI/CD deployment pipeline via Monitor (not just assuming push = deploy) — use a polling loop against the GitHub API deploy status until the deployment reaches 'success' or times out
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mq0oocdb_el5e score=5.1 created=2026-06-05 source=anti_pattern complexity=simple -->
- Do not Edit a file without first using Read or a targeted grep to confirm the exact current state of the function/block being replaced — cat+grep reconnaissance at the Bash level is not a substitute for a Read before Edit
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
