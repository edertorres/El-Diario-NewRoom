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

use BitAndBlack\Helpers\ArrayHelper;
use PHPUnit\Framework\TestCase;

/**
 * Class ArrayHelperTest
 *
 * @package BitAndBlack\Helpers\Tests\Helpers
 */
class ArrayHelperTest extends TestCase
{
    /**
     * @return void
     */
    public function testRecurse(): void
    {
        $input1 = 'hello';
        $input2 = [
            'Hello',
            [
                'world!',
                2 => 'Hello world!',
            ],
        ];

        $input1Converted = ArrayHelper::recurse(
            $input1,
            static fn ($input) => mb_strtoupper((string) $input)
        );

        self::assertSame(
            'HELLO',
            $input1Converted
        );

        $input2Converted = ArrayHelper::recurse(
            $input2,
            static function ($input) {
                if (!is_string($input)) {
                    return $input;
                }

                return mb_strtoupper($input);
            }
        );

        self::assertSame(
            [
                'HELLO',
                [
                    'WORLD!',
                    2 => 'HELLO WORLD!',
                ],
            ],
            $input2Converted
        );
    }

    /**
     * @return void
     */
    public function testUSortMulti(): void
    {
        $input1 = [
            [
                'a' => 'A',
                'b' => 'C',
            ],
            [
                'a' => 'B',
                'b' => 'B',
            ],
            [
                'a' => 'C',
                'b' => 'A',
            ],
        ];

        $order = [
            'b',
            'a',
        ];

        $input1Converted = ArrayHelper::usortMulti($input1, $order);

        self::assertSame(
            [
                [
                    'a' => 'C',
                    'b' => 'A',
                ],
                [
                    'a' => 'B',
                    'b' => 'B',
                ],
                [
                    'a' => 'A',
                    'b' => 'C',
                ],
            ],
            $input1Converted
        );
    }

    /**
     * @return void
     */
    public function testUniqueArray(): void
    {
        $input1 = [
            [
                'a' => 'Aa',
                'b' => 'Bb',
            ],
            [
                'a' => 'Cc',
                'b' => 'Dd',
            ],
            [
                'a' => 'Aa',
                'b' => 'Bb',
            ],
            [
                'a' => 'Aa',
                'b' => 'Ee',
            ],
        ];
        
        $input1Converted = ArrayHelper::uniqueArray($input1, 'a');

        self::assertSame(
            [
                [
                    'a' => 'Aa',
                    'b' => 'Bb',
                ],
                [
                    'a' => 'Cc',
                    'b' => 'Dd',
                ],
            ],
            $input1Converted
        );
    }

    /**
     * @return void
     */
    public function testGetIfIsArray(): void
    {
        $input1 = null;
        $input2 = [
            'hello',
        ];

        self::assertFalse(
            ArrayHelper::getIfIsArray($input1)
        );

        self::assertSame(
            $input2,
            ArrayHelper::getIfIsArray($input2)
        );

        self::assertSame(
            'return',
            ArrayHelper::getIfIsArray($input1, 'return')
        );
    }

    /**
     * @return void
     */
    public function testGetArray(): void
    {
        $input1 = 'string';
        $input2 = [
            'hello',
        ];

        self::assertSame(
            ['string'],
            ArrayHelper::getArray($input1)
        );

        self::assertSame(
            $input2,
            ArrayHelper::getArray($input2)
        );
    }

    /**
     * @return void
     */
    public function testGetValueIfKeyExists(): void
    {
        $input1 = [
            'a' => 'world',
        ];
        $input2 = [
            'hello' => 'world',
        ];

        self::assertSame(
            'return',
            ArrayHelper::getValueIfKeyExists($input1, 'hello', 'return')
        );

        self::assertSame(
            'world',
            ArrayHelper::getValueIfKeyExists($input2, 'hello')
        );
    }

    public function testRecurseWithKeys(): void
    {
        $input = [
            'foo' => [
                'bar' => 'foobar',
                'baz' => true,
            ],
        ];

        $valuesSeen = [];
        $keysSeen = [];

        $output = ArrayHelper::recurse(
            $input,
            static function ($value, $key = null) use (&$valuesSeen, &$keysSeen) {
                $valuesSeen[] = $value;
                $keysSeen[] = $key;

                if ('baz' === $key) {
                    $value = false;
                }

                return $value;
            }
        );

        self::assertNotSame(
            $input,
            $output
        );

        self::assertSame(
            ['bar', 'baz'],
            $keysSeen
        );

        self::assertSame(
            ['foobar', true],
            $valuesSeen
        );
    }
}
