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

use BitAndBlack\Helpers\NumberHelper;
use PHPUnit\Framework\TestCase;

/**
 * Class NumberHelperTest
 *
 * @package BitAndBlack\Helpers\Tests\Helpers
 */
class NumberHelperTest extends TestCase
{
    /**
     * @return void
     */
    public function testConvertNumber(): void
    {
        self::assertSame(
            '123456.00',
            NumberHelper::convertNumber(123456)
        );

        self::assertSame(
            '123,456.00',
            NumberHelper::convertNumber(123456, 2, '.', ',')
        );
        
        self::assertSame(
            '123,456.00',
            NumberHelper::convertNumber('12.3.456.0', 2, '.', ',')
        );
    }
}
