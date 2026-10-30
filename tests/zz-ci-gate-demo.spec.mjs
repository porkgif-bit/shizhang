// D13 守門演示：故意失敗，證明推送 dev 後 GitHub Actions 會標紅。下一個 commit 立即撤掉。
import { test, expect } from '@playwright/test';
test('D13 守門演示：這項故意失敗', () => { expect(1 + 1, '故意失敗，證明 CI 會擋下').toBe(3); });
