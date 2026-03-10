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

use BitAndBlack\Helpers\FileSystemHelper;
use PHPUnit\Framework\TestCase;

class FileSystemHelperTest extends TestCase
{
    public function testDeleteFolder(): void
    {
        $folders = [
            __DIR__ . DIRECTORY_SEPARATOR . 'test-folder',
            __DIR__ . DIRECTORY_SEPARATOR . 'test-folder' . DIRECTORY_SEPARATOR . 'nested-folder',
        ];

        foreach ($folders as $folder) {
            mkdir($folder);
            self::assertFileExists($folder);
        }

        FileSystemHelper::deleteFolder($folders[0]);

        self::assertFileDoesNotExist($folders[0]);
    }
}
