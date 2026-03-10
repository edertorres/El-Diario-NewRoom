<?php

/**
 * Bit&Black Helpers - Useful methods for PHP you may like.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Helpers\Tests;

use BitAndBlack\Helpers\SanitizeHelper;
use PHPUnit\Framework\TestCase;

/**
 * Class SanitizeHelperTest
 *
 * @package BitAndBlack\Helpers\Tests\Helpers
 */
class SanitizeHelperTest extends TestCase
{
    /**
     * @return void
     */
    public function testHtmlentities(): void
    {
        $value1 = '<b>Hällö!</b>';

        self::assertSame(
            '&lt;b&gt;H&auml;ll&ouml;!&lt;/b&gt;',
            SanitizeHelper::htmlEntities($value1)
        );
    }

    /**
     * @return void
     */
    public function testHtmlEntityDecode(): void
    {
        $value1 = '&lt;b&gt;H&auml;ll&ouml;!&lt;/b&gt;';

        self::assertSame(
            '<b>Hällö!</b>',
            SanitizeHelper::htmlEntityDecode($value1)
        );
    }

    /**
     * @return void
     */
    public function testHtmlSpecialChars(): void
    {
        $value1 = '<b>Hällö!</b>';

        self::assertSame(
            '&lt;b&gt;Hällö!&lt;/b&gt;',
            SanitizeHelper::htmlSpecialChars($value1)
        );
    }
}
