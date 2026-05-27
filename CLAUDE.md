# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpbnscy5_hemn score=5.3 created=2026-05-18 source=observation complexity=simple -->
- When uncommitted work exists only on an external drive, immediately rsync to local repo and commit before doing any other work — treat SSD-only state as a data-loss risk
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh466o_r31c score=5.4 created=2026-05-20 source=observation complexity=simple -->
- Before writing a workflow file, Read the existing file first to understand its current structure — even when replacing it wholesale
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh4676_jyhd score=5.9 created=2026-05-20 source=observation complexity=simple -->
- After pushing CI workflow changes, poll GitHub Actions runs via API (with sleep intervals) to confirm the triggered run reaches a terminal state before claiming success
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh467g_rz9t score=5.6 created=2026-05-20 source=observation complexity=simple -->
- After a Cloudflare Pages deployment completes, verify the live URL responds with the correct server header (cf-ray present) using curl -sI before marking the task complete
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh467o_4r9e score=5.1 created=2026-05-20 source=observation complexity=simple -->
- When migrating multiple repos to the same CI pattern, apply the workflow change to all repos in the same session and commit/push each one before checking deployment status
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh467v_2oqt score=5.1 created=2026-05-20 source=observation complexity=simple -->
- After completing infrastructure migrations, write a dedicated reference memory file (not inline in MEMORY.md) and then add an index entry pointing to it
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh4683_ymxx score=6 created=2026-05-20 source=anti_pattern complexity=simple -->
- Do not run git push without an explicit cd to the target repo directory — a bare 'git push' without a cd prefix was issued and may have targeted the wrong working directory
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpdh468a_5k5a score=5.3 created=2026-05-20 source=anti_pattern complexity=simple -->
- When polling CI status with sleep, prefer a single loop over multiple sequential Bash calls with repeated sleep — three separate polling calls were issued instead of one loop
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpff5ewj_mw7q score=5.9 created=2026-05-21 source=observation complexity=simple -->
- When fixing a parser bug, write a temporary test script (e.g., test-*.mts) to reproduce the issue with a real fixture file before editing source code — then delete the script after committing
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpff5ex5_sngi score=5 created=2026-05-21 source=observation complexity=simple -->
- After editing a parser/transformer function, run the test script against multiple fixture types (e.g., type A and type C SAF-T) to confirm the fix does not regress other variants
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
