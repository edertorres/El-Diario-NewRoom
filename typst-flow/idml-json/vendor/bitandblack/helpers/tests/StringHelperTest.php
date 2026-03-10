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

use BitAndBlack\Helpers\StringHelper;
use Generator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Class StringHelperTest
 *
 * @package BitAndBlack\Helpers\Tests
 */
class StringHelperTest extends TestCase
{
    /**
     * Tests if a string can be converted to bool
     *
     * @return void
     */
    public function testStringToBoolean(): void
    {
        $input1 = 'true';
        $input2 = 'false';
        $input3 = 'null';
        $input4 = 'string';
        $input5 = [
            'true',
            'string',
        ];
        $input6 = 'TRUE';
        $input7 = 'yes';
        $input8 = true;
        $input9 = 'Hello World!';

        self::assertTrue(
            StringHelper::stringToBoolean($input1)
        );

        self::assertFalse(
            StringHelper::stringToBoolean($input2)
        );

        self::assertNull(
            StringHelper::stringToBoolean($input3)
        );

        self::assertSame(
            'string',
            StringHelper::stringToBoolean($input4)
        );

        $input5Converted = StringHelper::stringToBoolean($input5);

        self::assertIsArray($input5Converted);
        self::assertTrue($input5Converted[0]);
        self::assertSame('string', $input5Converted[1]);

        self::assertTrue(
            StringHelper::stringToBoolean($input6)
        );

        self::assertIsString(
            StringHelper::stringToBoolean($input7)
        );

        self::assertTrue(
            StringHelper::stringToBoolean($input8)
        );

        self::assertSame(
            $input9,
            StringHelper::stringToBoolean($input9)
        );
    }

    /**
     * Tests if a string can be converted to bool
     *
     * @return void
     */
    public function testStringToBooleanAdvanced(): void
    {
        $input1 = 'true';
        $input2 = 'false';
        $input3 = 'null';
        $input4 = 'string';
        $input5 = [
            'true',
            'string',
            [
                'YES',
            ],
        ];
        $input6 = 'TRUE';
        $input7 = 'yes';
        $input8 = true;
        $input9 = 'Hello World!';

        self::assertTrue(
            StringHelper::stringToBooleanAdvanced($input1)
        );

        self::assertFalse(
            StringHelper::stringToBooleanAdvanced($input2)
        );

        self::assertNull(
            StringHelper::stringToBooleanAdvanced($input3)
        );

        self::assertSame(
            'string',
            StringHelper::stringToBooleanAdvanced($input4)
        );

        $input5Converted = StringHelper::stringToBooleanAdvanced($input5);

        self::assertIsArray($input5Converted);
        self::assertTrue($input5Converted[0]);
        
        self::assertSame(
            'string',
            $input5Converted[1]
        );

        self::assertTrue(
            $input5Converted[2][0]
        );
        
        self::assertTrue(
            StringHelper::stringToBooleanAdvanced($input6)
        );

        self::assertTrue(
            StringHelper::stringToBooleanAdvanced($input6)
        );

        self::assertTrue(
            StringHelper::stringToBooleanAdvanced($input7)
        );

        self::assertTrue(
            StringHelper::stringToBooleanAdvanced($input8)
        );

        self::assertSame(
            $input9,
            StringHelper::stringToBooleanAdvanced($input9)
        );
    }

    /**
     * Tests if a string can be converted to int
     *
     * @return void
     */
    public function testStringToInt(): void
    {
        $input1 = '123';
        $input2 = [
            '123',
            '456',
        ];
        $input3 = 'Hello World!';

        $input1Converted = StringHelper::stringToInt($input1);
        $input2Converted = StringHelper::stringToInt($input2);

        self::assertSame(
            123,
            $input1Converted
        );
        
        self::assertIsInt($input1Converted);

        self::assertIsArray($input2Converted);
        self::assertIsInt($input2Converted[0]);
        self::assertIsInt($input2Converted[1]);
        
        self::assertSame(
            123,
            $input2Converted[0]
        );
        
        self::assertSame(
            456,
            $input2Converted[1]
        );

        self::assertSame(
            $input3,
            StringHelper::stringToBoolean($input3)
        );
    }

    /**
     * Tests if a string can be converted to int
     *
     * @return void
     */
    public function testStringToFloat(): void
    {
        $input1 = '12.3';
        $input2 = [
            '1.23',
            '45.6',
        ];
        $input3 = 'Hello World!';

        self::assertSame(
            12.3,
            StringHelper::stringToFloat($input1)
        );

        $input2Converted = StringHelper::stringToFloat($input2);

        self::assertIsArray($input2Converted);
        self::assertIsFloat($input2Converted[0]);
        self::assertIsFloat($input2Converted[1]);
        
        self::assertSame(
            1.23,
            $input2Converted[0]
        );
        
        self::assertSame(
            45.6,
            $input2Converted[1]
        );

        self::assertSame(
            $input3,
            StringHelper::stringToBoolean($input3)
        );
    }

    /**
     * @return void
     */
    public function testStrReplaceMulti(): void
    {
        $input = [
            'Hello',
            [
                'world!',
                2 => 'Hello world!',
            ],
        ];

        $inputConverted = StringHelper::strReplaceMulti('Hello', 'elloH', $input);
        
        self::assertSame(
            [
                'elloH',
                [
                    'world!',
                    2 => 'elloH world!',
                ],
            ],
            $inputConverted
        );
    }
    
    public function testCanConvertBoolToString(): void
    {
        $input = [
            null,
            [
                true,
                false,
                'string',
            ],
        ];

        $inputConverted = StringHelper::booleanToString($input);

        self::assertSame(
            [
                'null',
                [
                    'true',
                    'false',
                    'string',
                ],
            ],
            $inputConverted
        );
    }
    
    public function testCanConvertToUpperCase(): void
    {
        self::assertSame(
            'Österreich',
            StringHelper::mbUcFirst('österreich')
        );

        self::assertSame(
            'SS',
            StringHelper::mbUcFirst('ß')
        );

        self::assertSame(
            [
                'Überkinger',
                false,
                [
                    123456,
                    'Österreich',
                ],
            ],
            StringHelper::mbUcFirst(
                [
                    'überkinger',
                    false,
                    [
                        123456,
                        'österreich',
                    ],
                ]
            )
        );
    }

    /**
     * @return void
     */
    #[DataProvider('getStringToNumberStrings')]
    public function testStringToNumber(mixed $input, mixed $expected): void
    {
        $output = StringHelper::stringToNumber($input);

        self::assertSame(
            $expected,
            $output
        );
    }

    public static function getStringToNumberStrings(): Generator
    {
        yield [10, 10];
        yield [10.25, 10.25];
        yield ['8.0', 8.0];
        yield ['1.23', 1.23];
        yield ['456', 456];
        yield ['1ab2', '1ab2'];
        yield ['50.0000000001', 50.0000000001];
    }

    #[DataProvider('getMbStrRevData')]
    public function testMbStrRev(string $input, string $expected): void
    {
        $output = StringHelper::mbStrrev($input);
        self::assertSame($expected, $output);
    }

    public static function getMbStrRevData(): Generator
    {
        yield ['ABC', 'CBA'];
        yield ['ÄÖÜ', 'ÜÖÄ'];
        yield ['يناير', 'رياني'];
    }
}
