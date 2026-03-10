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

use BitAndBlack\Helpers\RequestHelper;
use PHPUnit\Framework\TestCase;

/**
 * Class RequestHelperTest
 *
 * @package BitAndBlack\Helpers\Tests\Helpers
 */
class RequestHelperTest extends TestCase
{
    /**
     * @return void
     */
    public function testSortUploadFiles(): void
    {
        $input = [
            'name' => [
                'file0' => 'file1.jpg',
                'file1' => 'file2.tif',
                0 => 'file2.tif',
            ],
            'type' => [
                'file0' => 'image/jpeg',
                'file1' => 'image/tiff',
                0 => 'image/tiff',
            ],
            'tmp_name' => [
                'file0' => '/tmp/phpn3FmFr2',
                'file1' => '/tmp/phpn3FmFr1',
                0 => '/tmp/phpn3FmFr3',
            ],
            'error' => [
                'file0' => 0,
                'file1' => 1,
                0 => 2,
            ],
            'size' => [
                'file0' => 154760,
                'file1' => 15476,
                0 => 16295,
            ],
        ];
        
        $input1Converted = RequestHelper::sortUploadFiles($input);
        
        self::assertCount(
            3,
            $input1Converted
        );

        self::assertSame(
            $input['name']['file0'],
            $input1Converted['file0']['name']
        );

        self::assertSame(
            $input['name']['file1'],
            $input1Converted['file1']['name']
        );

        self::assertSame(
            $input['name'][0],
            $input1Converted[0]['name']
        );
    }
}
