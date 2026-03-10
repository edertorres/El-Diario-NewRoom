<?php

/**
 * Bit&Black Helpers - Useful methods for PHP you may like.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Helpers;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Class FileSystemHelper.
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\FileSystemHelperTest
 */
class FileSystemHelper
{
    /**
     * Deletes a folder with all of its files.
     *
     * @param string $folder Path to the folder.
     * @return bool
     */
    public static function deleteFolder(string $folder): bool
    {
        $recursiveDirectoryIterator = new RecursiveDirectoryIterator($folder, FilesystemIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($recursiveDirectoryIterator, RecursiveIteratorIterator::CHILD_FIRST);

        /** @var SplFileInfo $file */
        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
                continue;
            }

            unlink($file->getRealPath());
        }
        
        return rmdir($folder);
    }

    /**
     * Copies a whole folder with all of its contents, including subfolders.
     *
     * @param string $sourceFolder         The source folder, where the files should be copied from.
     * @param string $destinationFolder    The destination folder, where the file should be copied to.
     * @param bool $clearDestinationFolder If the destination folder should be cleared at first.
     * @return void
     * @throws Exception
     */
    public static function copyFolder(string $sourceFolder, string $destinationFolder, bool $clearDestinationFolder = true): void
    {
        $dir = opendir($sourceFolder);

        if (false === $dir) {
            return;
        }

        if ($clearDestinationFolder && is_dir($destinationFolder)) {
            self::deleteFolder($destinationFolder);
        }

        if (!mkdir($destinationFolder) && !is_dir($destinationFolder)) {
            throw new Exception(
                sprintf('Directory "%s" was not created', $destinationFolder)
            );
        }

        while ($file = readdir($dir)) {
            if ('.' !== $file && '..' !== $file) {
                if (is_dir($sourceFolder . DIRECTORY_SEPARATOR . $file)) {
                    self::copyFolder(
                        $sourceFolder . DIRECTORY_SEPARATOR . $file,
                        $destinationFolder . DIRECTORY_SEPARATOR . $file,
                        $clearDestinationFolder
                    );
                    continue;
                }

                copy($sourceFolder . DIRECTORY_SEPARATOR . $file, $destinationFolder . DIRECTORY_SEPARATOR . $file);
            }
        }

        closedir($dir);
    }
}
